"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const serverless_http_1 = __importDefault(require("serverless-http"));
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
app.get('/test-minimal', (_req, res) => {
    res.status(200).json({
        message: 'Minimal test working!',
        timestamp: new Date().toISOString()
    });
});
exports.default = (0, serverless_http_1.default)(app);
exports.config = {
    maxDuration: 5,
    memory: 512,
};
//# sourceMappingURL=test-minimal.js.map