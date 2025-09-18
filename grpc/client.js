const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const roleService = require('./role_service');

const ROLE_PROTO_PATH = path.join(__dirname, 'proto/role.proto');
const REGISTRY_PROTO_PATH = path.join(__dirname, 'proto/registry.proto');

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

const role_proto = grpc.loadPackageDefinition(rolePackageDefinition).role_center;
const registry_proto = grpc.loadPackageDefinition(registryPackageDefinition).registry;

const GRPC_SERVER_ADDRESS = process.env.GRPC_SERVER_ADDRESS;
const GRPC_TOKEN = process.env.GRPC_TOKEN;
const GRPC_SERVER_NAME = process.env.GRPC_SERVER_NAME;

let heartbeatInterval;

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
    }
  });

  call.on('end', () => {
    console.log('[grpc_client] gRPC connection to gateway ended. Reconnecting in 5 seconds...');
    clearInterval(heartbeatInterval);
    setTimeout(startGrpcClient, 5000);
  });

  call.on('error', (err) => {
    console.error('[grpc_client] gRPC connection error:', err);
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
    const heartbeat = {
      timestamp: Date.now(),
    };
    if (call.writable) {
      call.write({ heartbeat: heartbeat });
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

module.exports = { startGrpcClient };