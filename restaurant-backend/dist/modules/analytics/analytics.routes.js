"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const auth_1 = require("../../middleware/auth");
const restaurant_1 = require("../../middleware/restaurant");
const analytics_service_1 = require("../../modules/analytics/analytics.service");
const database_1 = require("../../config/database");
const generative_ai_1 = require("@google/generative-ai");
const router = (0, express_1.Router)();
const dateQuerySchema = zod_1.z.object({
    date: zod_1.z.string().optional(),
});
const overviewQuerySchema = zod_1.z.object({
    start: zod_1.z.string().optional(),
    end: zod_1.z.string().optional(),
});
const parseDateInput = (value) => {
    if (!value)
        return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error('Invalid date format');
    }
    return date;
};
router.use(auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'));
const insightsBodySchema = zod_1.z.object({
    topDishes: zod_1.z.array(zod_1.z.string().min(1)).min(1),
    pendingDeliveries: zod_1.z.number().int().nonnegative(),
    totalOrders: zod_1.z.number().int().nonnegative(),
});
const insightsResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z
        .array(zod_1.z.object({
        type: zod_1.z.enum(['growth', 'alert']),
        title: zod_1.z.string().min(1),
        desc: zod_1.z.string().min(1),
    }))
        .length(2),
});
const ensureTwoSentences = (text) => {
    const sentences = text
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    return sentences.length === 2;
};
const callGemini = async (systemPrompt, userPrompt) => {
    const apiKey = process.env['GOOGLE_API_KEY'] || process.env['GOOGLE_CLOUD_API_KEY'];
    if (!apiKey) {
        throw new Error('Google API Key not configured. Set GOOGLE_API_KEY or GOOGLE_CLOUD_API_KEY.');
    }
    const client = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
        model: 'gemini-1.5-pro',
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 512,
            responseMimeType: 'text/plain',
        },
    });
    const response = await model.generateContent({
        systemInstruction: systemPrompt,
        contents: [
            {
                role: 'user',
                parts: [{ text: userPrompt }],
            },
        ],
    });
    const text = response?.response?.text?.();
    if (!text) {
        throw new Error('Gemini returned empty response');
    }
    return text;
};
const callOpenAI = async (systemPrompt, userPrompt) => {
    const key = process.env['OPENAI_API_KEY'];
    if (!key) {
        throw new Error('OpenAI API Key not configured. Set OPENAI_API_KEY.');
    }
    const { OpenAI } = await Promise.resolve().then(() => __importStar(require('openai')));
    const client = new OpenAI({ apiKey: key });
    const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.2,
    });
    const text = completion?.choices?.[0]?.message?.content;
    if (!text) {
        throw new Error('OpenAI returned empty response');
    }
    return text;
};
const generateAIOperationalInsights = async (payload) => {
    const systemPrompt = 'You are a restaurant operations consultant. Provide exactly 2 concise, actionable insights based on the provided live metrics. Return output as valid JSON with success=true and data array of 2 objects with type (growth|alert), title, desc. desc must be exactly 2 sentences. Do not add any extra fields or top-level commentary.';
    const userPrompt = `Live data in JSON:\n${JSON.stringify(payload, null, 2)}\n\nReturn response in this exact format:\n{\n  \"success\": true,\n  \"data\": [\n    {\n      \"type\": \"growth\",\n      \"title\": \"Short catchy title\",\n      \"desc\": \"A concise, 2-sentence actionable recommendation based on the data.\"\n    },\n    {\n      \"type\": \"alert\",\n      \"title\": \"Another title\",\n      \"desc\": \"Another 2-sentence recommendation.\"\n    }\n  ]\n}`;
    let rawText;
    if (process.env['GOOGLE_API_KEY'] || process.env['GOOGLE_CLOUD_API_KEY']) {
        rawText = await callGemini(systemPrompt, userPrompt);
    }
    else if (process.env['OPENAI_API_KEY']) {
        rawText = await callOpenAI(systemPrompt, userPrompt);
    }
    else {
        throw new Error('No LLM provider configured. Set GOOGLE_API_KEY/GOOGLE_CLOUD_API_KEY or OPENAI_API_KEY.');
    }
    const cleanedText = rawText.trim();
    let parsed;
    try {
        parsed = JSON.parse(cleanedText);
    }
    catch (err) {
        throw new Error(`Failed to parse LLM response as JSON: ${err.message}`);
    }
    const shaped = insightsResponseSchema.safeParse(parsed);
    if (!shaped.success) {
        throw new Error(`LLM response does not match required schema: ${JSON.stringify(shaped.error.issues)}`);
    }
    for (const insight of shaped.data.data) {
        if (!ensureTwoSentences(insight.desc)) {
            throw new Error('One of the insights does not contain exactly 2 sentences in desc.');
        }
    }
    return shaped.data;
};
router.post('/insights', async (req, res) => {
    try {
        const payload = insightsBodySchema.parse(req.body);
        const result = await generateAIOperationalInsights(payload);
        return res.json(result);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
        }
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return res.status(500).json({ success: false, error: message });
    }
});
router.get('/daily', async (req, res) => {
    try {
        const query = dateQuerySchema.parse(req.query);
        const date = parseDateInput(query.date) || new Date();
        const snapshot = await (0, analytics_service_1.generateAnalyticsSnapshot)({
            restaurantId: req.restaurant.id,
            periodType: client_1.AnalyticsPeriodType.DAILY,
            date,
        });
        return res.json({ success: true, data: snapshot });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
        }
        if (error instanceof Error && error.message === 'Invalid date format') {
            return res.status(400).json({ success: false, error: error.message });
        }
        return res.status(500).json({ success: false, error: 'Failed to generate daily analytics' });
    }
});
router.get('/weekly', async (req, res) => {
    try {
        const query = dateQuerySchema.parse(req.query);
        const date = parseDateInput(query.date) || new Date();
        const snapshot = await (0, analytics_service_1.generateAnalyticsSnapshot)({
            restaurantId: req.restaurant.id,
            periodType: client_1.AnalyticsPeriodType.WEEKLY,
            date,
        });
        return res.json({ success: true, data: snapshot });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
        }
        if (error instanceof Error && error.message === 'Invalid date format') {
            return res.status(400).json({ success: false, error: error.message });
        }
        return res.status(500).json({ success: false, error: 'Failed to generate weekly analytics' });
    }
});
router.get('/overview', async (req, res) => {
    try {
        const query = overviewQuerySchema.parse(req.query);
        const end = parseDateInput(query.end) || new Date();
        const start = parseDateInput(query.start) || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        const overview = await (0, analytics_service_1.getAnalyticsOverview)({
            restaurantId: req.restaurant.id,
            start,
            end,
        });
        return res.json({ success: true, data: overview });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
        }
        if (error instanceof Error) {
            return res.status(400).json({ success: false, error: error.message });
        }
        return res.status(500).json({ success: false, error: 'Failed to generate analytics overview' });
    }
});
router.get('/history', async (req, res) => {
    const snapshots = await database_1.prisma.analyticsSnapshot.findMany({
        where: {
            restaurantId: req.restaurant.id,
        },
        orderBy: { generatedAt: 'desc' },
        take: 30,
    });
    return res.json({ success: true, data: snapshots });
});
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map