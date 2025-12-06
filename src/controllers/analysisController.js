const featureExtractor = require('../services/featureExtractor');
const llmService = require('../services/llmService');
const User = require('../models/User');
const { getDatabase } = require('../database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

exports.analyze = async (req, res, next) => {
  try {
    const userGuid = req.body.userId; // userId ist eigentlich die GUID
    
    if (!userGuid) {
      return res.status(400).json({ error: 'userId (GUID) is required' });
    }
    
    // Finde User anhand der GUID
    const user = await User.findByGuid(userGuid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = user.id;
    const days = parseInt(req.body.days) || 30;
    
    logger.info(`Starting analysis for user ${userGuid} (id: ${userId}), ${days} days`);
    
    // Extract features (verwendet userId, nicht GUID)
    const features = await featureExtractor.extractFeatures(userId, days);
    
    // Perform LLM analysis
    const analysis = await llmService.analyze(features, userGuid);
    
    // Store analysis result
    const db = getDatabase();
    const analysisId = uuidv4();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const stmt = db.prepare(`
      INSERT INTO analysis_results (
        id, user_id, analysis_date, data_period_start, data_period_end,
        insights, recommendations, confidence_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.run(
      analysisId,
      userId,
      new Date().toISOString(),
      startDate.toISOString(),
      new Date().toISOString(),
      JSON.stringify(analysis.insights),
      JSON.stringify(analysis.recommendations),
      analysis.confidenceScore
    );
    
    logger.info(`Analysis completed for user ${userGuid} (id: ${userId})`, { analysisId });
    
    res.json({
      success: true,
      data: {
        analysisId,
        ...analysis
      }
    });
  } catch (error) {
    logger.error('Error in analysis:', error);
    next(error);
  }
};

exports.getLatest = async (req, res, next) => {
  try {
    const userGuid = req.query.userId; // userId ist eigentlich die GUID
    
    if (!userGuid) {
      return res.status(400).json({ error: 'userId (GUID) is required' });
    }
    
    // Finde User anhand der GUID
    const user = await User.findByGuid(userGuid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = user.id;
    const db = getDatabase();
    
    const stmt = db.prepare(`
      SELECT * FROM analysis_results
      WHERE user_id = ?
      ORDER BY analysis_date DESC
      LIMIT 1
    `);
    
    const row = await stmt.get(userId);
    
    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'No analysis found for this user'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: row.id,
        analysisDate: row.analysis_date,
        dataPeriodStart: row.data_period_start,
        dataPeriodEnd: row.data_period_end,
        insights: JSON.parse(row.insights),
        recommendations: JSON.parse(row.recommendations),
        confidenceScore: row.confidence_score,
        createdAt: row.created_at
      }
    });
  } catch (error) {
    logger.error('Error fetching latest analysis:', error);
    next(error);
  }
};


