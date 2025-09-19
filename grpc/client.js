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

function startGrpcClient() {
  if (process.env.GRPC_ENABLED !== 'true') {
    console.log('[grpc_client] gRPC client is disabled.');
    return;
  }

  const registryClient = new registry_proto.RegistryService(
    GRPC_SERVER_ADDRESS,
    grpc.credentials.createInsecure()
  );

  const call = registryClient.EstablishConnection();

  call.on('data', (message) => {
    if (message.request) {
      handleRequest(message.request, call);
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
    if (!connectionId) {
      reject(new Error('No active gRPC connection'));
      return;
    }

    const registryClient = new registry_proto.RegistryService(
      GRPC_SERVER_ADDRESS,
      grpc.credentials.createInsecure()
    );

    const call = registryClient.EstablishConnection();
    let requestSent = false;

    call.on('data', (message) => {
      if (message.response) {
        try {
          // 根据 grpcPath 判断服务类型并选择正确的解码方式
          if (grpcPath.includes('RecommendationService/GetRecommendationsByAuthor')) {
            const decodedResponse = recommendation_pb.GetRecommendationsByAuthorResponse.deserializeBinary(message.response.payload);
            resolve(decodedResponse.toObject());
          } else {
            // 对于其他服务，返回原始响应或添加更多服务支持
            resolve({
              raw_payload: message.response.payload,
              status_code: message.response.status_code
            });
          }
        } catch (error) {
          reject(new Error(`Failed to decode response: ${error.message}`));
        }
        call.end();
      } else if (message.status && message.status.status === 'CONNECTED' && !requestSent) {
        let requestPayload;

        // 根据 grpcPath 选择正确的请求类型
        if (grpcPath.includes('RecommendationService/GetRecommendationsByAuthor')) {
          const requestMessage = new recommendation_pb.GetRecommendationsByAuthorRequest();
          requestMessage.setAuthorId(requestData.author_id);
          requestMessage.setGuildId(requestData.guild_id);
          requestPayload = requestMessage.serializeBinary();
        } else {
          // 对于其他服务，可以扩展支持
          reject(new Error(`Unsupported service path: ${grpcPath}`));
          return;
        }

        const forwardRequest = {
          method_path: grpcPath,
          payload: requestPayload,
          request_id: Date.now().toString(),
        };

        call.write({ request: forwardRequest });
        requestSent = true;
      }
    });

    call.on('error', (err) => {
      reject(new Error(`gRPC call error: ${err.message}`));
    });

    call.on('end', () => {
      if (!requestSent) {
        reject(new Error('Connection ended before request could be sent'));
      }
    });

    const register = {
      api_key: GRPC_TOKEN,
      services: ['role_center.RoleService'],
    };

    call.write({ register: register });
  });
}

module.exports = { startGrpcClient, queryThroughGateway, recommendation_proto };