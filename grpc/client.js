const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const roleService = require('./role_service');

// 导入生成的 protobuf 文件
const recommendation_pb = require('./generated/recommendation_pb');

const ROLE_PROTO_PATH = path.join(__dirname, 'proto/role.proto');
const REGISTRY_PROTO_PATH = path.join(__dirname, 'proto/registry.proto');
const RECOMMENDATION_PROTO_PATH = path.join(__dirname, 'proto/recommendation.proto');

const rolePackageDefinition = protoLoader.loadSync(ROLE_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const registryPackageDefinition = protoLoader.loadSync(REGISTRY_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const recommendationPackageDefinition = protoLoader.loadSync(RECOMMENDATION_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const role_proto = grpc.loadPackageDefinition(rolePackageDefinition).role_center;
const registry_proto = grpc.loadPackageDefinition(registryPackageDefinition).registry;
const recommendation_proto = grpc.loadPackageDefinition(recommendationPackageDefinition).recommendation;

const GRPC_SERVER_ADDRESS = process.env.GRPC_SERVER_ADDRESS;
const GRPC_TOKEN = process.env.GRPC_TOKEN;
const GRPC_SERVER_NAME = process.env.GRPC_SERVER_NAME;

let heartbeatInterval;
let connectionId = null;
let registryClient = null;
let call = null;
const pendingRequests = new Map();

function startGrpcClient() {
  if (process.env.GRPC_ENABLED !== 'true') {
    console.log('[grpc_client] gRPC client is disabled.');
    return;
  }

  registryClient = new registry_proto.RegistryService(
    GRPC_SERVER_ADDRESS,
    grpc.credentials.createInsecure()
  );

  call = registryClient.EstablishConnection();

  call.on('data', (message) => {
    if (message.request) {
      handleRequest(message.request, call);
    } else if (message.response) {
      const { request_id, payload, status_code } = message.response;
      if (pendingRequests.has(request_id)) {
        const { resolve, reject } = pendingRequests.get(request_id);
        if (status_code === 200) {
          try {
            const decodedResponse = recommendation_pb.GetRecommendationsByAuthorResponse.deserializeBinary(payload);
            resolve(decodedResponse.toObject());
          } catch (error) {
            reject(new Error(`Failed to decode response: ${error.message}`));
          }
        } else {
          reject(new Error(`gRPC query failed with status code: ${status_code}`));
        }
        pendingRequests.delete(request_id);
      }
    } else if (message.status && message.status.status === 'CONNECTED') {
      connectionId = message.status.connection_id;
      console.log(`[grpc_client] Connection established with ID: ${connectionId}`);
    } else {
      console.log('[grpc_client] Received unhandled message type:', JSON.stringify(message));
    }
  });

  call.on('end', () => {
    console.log('[grpc_client] gRPC connection to gateway ended. Reconnecting in 5 seconds...');
    clearInterval(heartbeatInterval);
    console.log(`[grpc_client] Connection ID ${connectionId} cleared due to connection end.`);
    connectionId = null;
    setTimeout(startGrpcClient, 5000);
  });

  call.on('error', (err) => {
    console.error('[grpc_client] gRPC connection error:', err);
    connectionId = null;
    // gRPC-js docs say 'end' is emitted after 'error', so reconnect logic is in 'end' handler.
  });

  const register = {
    api_key: GRPC_TOKEN,
    services: ['role_center.RoleService'],
  };

  call.write({ register: register });
  console.log('[grpc_client] gRPC client registered with gateway.');

  // 心跳机制
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  heartbeatInterval = setInterval(() => {
    if (connectionId) {
      const heartbeat = {
        connection_id: connectionId,
        timestamp: Date.now(),
      };
      if (call.writable) {
        // console.log(`[grpc_client] Sending heartbeat with connection ID: ${connectionId}`);
        call.write({ heartbeat: heartbeat });
      }
    }
  }, 30000);
}

function handleRequest(request, call) {
  const { method_path, payload, request_id } = request;
  const [_, serviceName, methodName] = method_path.split('/');

  if (serviceName === 'role_center.RoleService') {
    const method = roleService[methodName];
    if (method) {
      // 动态创建请求消息类型
      const RequestType = role_proto[capitalizeFirstLetter(methodName) + 'Request'];
      const message = RequestType.decode(payload);

      method({ request: message.toObject() }, (err, response) => {
        if (err) {
          console.error(`[grpc_client] Error handling ${method_path}:`, err);
          // 可以选择向网关返回错误
          return;
        }

        // 动态创建响应消息类型
        const ResponseType = role_proto[capitalizeFirstLetter(methodName) + 'Response'];
        const responseMessage = ResponseType.create(response);
        const responsePayload = ResponseType.encode(responseMessage).finish();

        const forwardResponse = {
          request_id: request_id,
          payload: responsePayload,
          status_code: 200,
        };
        call.write({ response: forwardResponse });
      });
    }
  }
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

async function queryThroughGateway(grpcPath, requestData) {
  return new Promise((resolve, reject) => {
    if (!call || !call.writable) {
      return reject(new Error('No active gRPC connection or connection not writable.'));
    }

    const requestId = `${Date.now()}-${Math.random()}`;
    let requestPayload;

    if (grpcPath.includes('RecommendationService/GetRecommendationsByAuthor')) {
      const requestMessage = new recommendation_pb.GetRecommendationsByAuthorRequest();
      requestMessage.setAuthorId(requestData.author_id);
      requestMessage.setGuildId(requestData.guild_id);
      requestPayload = requestMessage.serializeBinary();
    } else {
      return reject(new Error(`Unsupported service path: ${grpcPath}`));
    }

    const forwardRequest = {
      method_path: grpcPath,
      payload: requestPayload,
      request_id: requestId,
    };

    pendingRequests.set(requestId, { resolve, reject });

    call.write({ request: forwardRequest });

    // 设置超时
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error(`Request timed out for ${grpcPath}`));
      }
    }, 10000); // 10秒超时
  });
}

module.exports = { startGrpcClient, queryThroughGateway, recommendation_proto };