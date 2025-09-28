"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("../vercel-env");
const serverless_http_1 = __importDefault(require("serverless-http"));
const server_minimal_1 = __importDefault(require("../src/server-minimal"));
exports.default = (0, serverless_http_1.default)(server_minimal_1.default);
exports.config = {
    maxDuration: 5,
    memory: 512,
};
//# sourceMappingURL=minimal.js.map