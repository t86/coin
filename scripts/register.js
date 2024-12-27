const { ReadableStream, WritableStream, TransformStream } = require('web-streams-polyfill');
const { Blob } = require('buffer');
const { FormData, Headers, Request, Response, fetch } = require('undici');

// 设置全局变量
Object.assign(global, {
    ReadableStream,
    WritableStream,
    TransformStream,
    Blob,
    FormData,
    Headers,
    Request,
    Response,
    fetch
}); 