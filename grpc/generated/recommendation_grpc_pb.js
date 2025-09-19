// GENERATED CODE -- DO NOT EDIT!

// Original file comments:
// amway 系统的安利 proto 定义文件
// 与目前的系统无关
'use strict';
var grpc = require('@grpc/grpc-js');
var recommendation_pb = require('./recommendation_pb.js');

function serialize_recommendation_GetRecommendationRequest(arg) {
  if (!(arg instanceof recommendation_pb.GetRecommendationRequest)) {
    throw new Error('Expected argument of type recommendation.GetRecommendationRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_recommendation_GetRecommendationRequest(buffer_arg) {
  return recommendation_pb.GetRecommendationRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_recommendation_GetRecommendationsByAuthorRequest(arg) {
  if (!(arg instanceof recommendation_pb.GetRecommendationsByAuthorRequest)) {
    throw new Error('Expected argument of type recommendation.GetRecommendationsByAuthorRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_recommendation_GetRecommendationsByAuthorRequest(buffer_arg) {
  return recommendation_pb.GetRecommendationsByAuthorRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_recommendation_GetRecommendationsByAuthorResponse(arg) {
  if (!(arg instanceof recommendation_pb.GetRecommendationsByAuthorResponse)) {
    throw new Error('Expected argument of type recommendation.GetRecommendationsByAuthorResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_recommendation_GetRecommendationsByAuthorResponse(buffer_arg) {
  return recommendation_pb.GetRecommendationsByAuthorResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_recommendation_RecommendationSlip(arg) {
  if (!(arg instanceof recommendation_pb.RecommendationSlip)) {
    throw new Error('Expected argument of type recommendation.RecommendationSlip');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_recommendation_RecommendationSlip(buffer_arg) {
  return recommendation_pb.RecommendationSlip.deserializeBinary(new Uint8Array(buffer_arg));
}


// Service Definition
var RecommendationServiceService = exports.RecommendationServiceService = {
  // 根据 ID 获取一个安利小纸条
getRecommendation: {
    path: '/recommendation.RecommendationService/GetRecommendation',
    requestStream: false,
    responseStream: false,
    requestType: recommendation_pb.GetRecommendationRequest,
    responseType: recommendation_pb.RecommendationSlip,
    requestSerialize: serialize_recommendation_GetRecommendationRequest,
    requestDeserialize: deserialize_recommendation_GetRecommendationRequest,
    responseSerialize: serialize_recommendation_RecommendationSlip,
    responseDeserialize: deserialize_recommendation_RecommendationSlip,
  },
  // 查询一个用户ID全部的小纸条
getRecommendationsByAuthor: {
    path: '/recommendation.RecommendationService/GetRecommendationsByAuthor',
    requestStream: false,
    responseStream: false,
    requestType: recommendation_pb.GetRecommendationsByAuthorRequest,
    responseType: recommendation_pb.GetRecommendationsByAuthorResponse,
    requestSerialize: serialize_recommendation_GetRecommendationsByAuthorRequest,
    requestDeserialize: deserialize_recommendation_GetRecommendationsByAuthorRequest,
    responseSerialize: serialize_recommendation_GetRecommendationsByAuthorResponse,
    responseDeserialize: deserialize_recommendation_GetRecommendationsByAuthorResponse,
  },
};

exports.RecommendationServiceClient = grpc.makeGenericClientConstructor(RecommendationServiceService, 'RecommendationService');
