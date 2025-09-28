"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeLogger = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
console.log('logger.ts: Starting module load');
const isServerless = process.env['VERCEL'] || process.env['NOW_REGION'];
console.log('logger.ts: Serverless environment:', isServerless);
const transports = [
    new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
    }),
];
console.log('logger.ts: Console transport configured');
console.log('logger.ts: Creating logger instance');
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.simple(),
    defaultMeta: { service: 'restaurant-backend' },
    transports,
});
console.log('logger.ts: Logger instance created');
const closeLogger = () => {
    console.log('logger.ts: Closing logger');
    exports.logger.close();
    console.log('logger.ts: Logger closed');
};
exports.closeLogger = closeLogger;
console.log('logger.ts: Module load complete');
//# sourceMappingURL=logger.js.map