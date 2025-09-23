// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var role_pb = require('./role_pb.js');

function serialize_role_center_AssignRoleRequest(arg) {
  if (!(arg instanceof role_pb.AssignRoleRequest)) {
    throw new Error('Expected argument of type role_center.AssignRoleRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_role_center_AssignRoleRequest(buffer_arg) {
  return role_pb.AssignRoleRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_role_center_AssignRoleResponse(arg) {
  if (!(arg instanceof role_pb.AssignRoleResponse)) {
    throw new Error('Expected argument of type role_center.AssignRoleResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_role_center_AssignRoleResponse(buffer_arg) {
  return role_pb.AssignRoleResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_role_center_GetRoleAssignmentsRequest(arg) {
  if (!(arg instanceof role_pb.GetRoleAssignmentsRequest)) {
    throw new Error('Expected argument of type role_center.GetRoleAssignmentsRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_role_center_GetRoleAssignmentsRequest(buffer_arg) {
  return role_pb.GetRoleAssignmentsRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_role_center_GetRoleAssignmentsResponse(arg) {
  if (!(arg instanceof role_pb.GetRoleAssignmentsResponse)) {
    throw new Error('Expected argument of type role_center.GetRoleAssignmentsResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_role_center_GetRoleAssignmentsResponse(buffer_arg) {
  return role_pb.GetRoleAssignmentsResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_role_center_GetUserRolesRequest(arg) {
  if (!(arg instanceof role_pb.GetUserRolesRequest)) {
    throw new Error('Expected argument of type role_center.GetUserRolesRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_role_center_GetUserRolesRequest(buffer_arg) {
  return role_pb.GetUserRolesRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_role_center_GetUserRolesResponse(arg) {
  if (!(arg instanceof role_pb.GetUserRolesResponse)) {
    throw new Error('Expected argument of type role_center.GetUserRolesResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_role_center_GetUserRolesResponse(buffer_arg) {
  return role_pb.GetUserRolesResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


// RoleService 定义了与身份组相关的查询功能
var RoleServiceService = exports.RoleServiceService = {
  // 查询一个用户拥有的所有身份组
getUserRoles: {
    path: '/role_center.RoleService/GetUserRoles',
    requestStream: false,
    responseStream: false,
    requestType: role_pb.GetUserRolesRequest,
    responseType: role_pb.GetUserRolesResponse,
    requestSerialize: serialize_role_center_GetUserRolesRequest,
    requestDeserialize: deserialize_role_center_GetUserRolesRequest,
    responseSerialize: serialize_role_center_GetUserRolesResponse,
    responseDeserialize: deserialize_role_center_GetUserRolesResponse,
  },
  // 查询一个身份组下的所有用户
getRoleAssignments: {
    path: '/role_center.RoleService/GetRoleAssignments',
    requestStream: false,
    responseStream: false,
    requestType: role_pb.GetRoleAssignmentsRequest,
    responseType: role_pb.GetRoleAssignmentsResponse,
    requestSerialize: serialize_role_center_GetRoleAssignmentsRequest,
    requestDeserialize: deserialize_role_center_GetRoleAssignmentsRequest,
    responseSerialize: serialize_role_center_GetRoleAssignmentsResponse,
    responseDeserialize: deserialize_role_center_GetRoleAssignmentsResponse,
  },
  // 为用户分配身份组
assignRole: {
    path: '/role_center.RoleService/AssignRole',
    requestStream: false,
    responseStream: false,
    requestType: role_pb.AssignRoleRequest,
    responseType: role_pb.AssignRoleResponse,
    requestSerialize: serialize_role_center_AssignRoleRequest,
    requestDeserialize: deserialize_role_center_AssignRoleRequest,
    responseSerialize: serialize_role_center_AssignRoleResponse,
    responseDeserialize: deserialize_role_center_AssignRoleResponse,
  },
};

exports.RoleServiceClient = grpc.makeGenericClientConstructor(RoleServiceService, 'RoleService');
