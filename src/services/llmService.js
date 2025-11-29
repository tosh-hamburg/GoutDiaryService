const OpenAI = require('openai');
const logger = require('../utils/logger');

class LLMService {
  constructor() {
    // Lade .env explizit falls nicht bereits geladen
    if (!process.env.OPENAI_API_KEY) {
      require('dotenv').config();
    }
    
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey || apiKey === 'sk-your-api-key-here') {
      logger.warn('OPENAI_API_KEY nicht gesetzt - LLM-Funktionen werden nicht verfügbar sein');
      this.client = null;
      this.model = process.env.LLM_MODEL || 'gpt-4-turbo-preview';
    } else {
      this.client = new OpenAI({
        apiKey: apiKey
      });
      this.model = process.env.LLM_MODEL || 'gpt-4-turbo-preview';
    }
  }
  
  async analyze(features, userId) {
    try {
      if (!this.client) {
        throw new Error('OpenAI API Key nicht konfiguriert. Bitte setze OPENAI_API_KEY in der .env Datei.');
      }
      
      logger.info(`Starting LLM analysis for user ${userId}`);
      
      const prompt = this.buildPrompt(features);
      
      // Aktueller OpenAI API-Aufruf (v4.x)
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' } // Erzwingt JSON-Format
      });
      
      // Response-Struktur: response.choices[0].message.content
      const content = response.choices[0].message.content;
      const analysis = JSON.parse(content);
      
      // Add metadata
      analysis.analysisId = `analysis_${userId}_${Date.now()}`;
      analysis.confidenceScore = this.calculateConfidence(features);
      analysis.analysisDate = new Date().toISOString();
      
      logger.info(`LLM analysis completed for user ${userId}`);
      
      return analysis;
    } catch (error) {
      logger.error('LLM analysis error:', error);
      throw new Error(`LLM analysis failed: ${error.message}`);
    }
  }
  
  getSystemPrompt() {
    return `Du bist ein medizinischer Assistent spezialisiert auf Gicht und Harnsäure-Management.

WICHTIGE REGELN:
1. Stelle KEINE Diagnosen - verweise immer auf einen Arzt bei medizinischen Problemen
2. Alle Empfehlungen müssen evidenzbasiert und wissenschaftlich fundiert sein
3. Sei spezifisch und umsetzbar in deinen Empfehlungen
4. Berücksichtige die individuellen Muster des Patienten
5. Antworte IMMER im folgenden JSON-Format:

{
  "insights": {
    "dietary_factors": ["Faktor 1", "Faktor 2"],
    "lifestyle_factors": ["Faktor 1"],
    "correlations": [
      {"factor": "Fleischkonsum", "correlation": 0.75, "description": "..."}
    ],
    "patterns": [
      {"pattern": "Wochenend-Effekt", "description": "..."}
    ],
    "risk_periods": ["Beschreibung"]
  },
  "recommendations": {
    "dietary": [
      {"priority": "high", "action": "Reduziere Fleischkonsum", "details": "..."}
    ],
    "lifestyle": [
      {"priority": "medium", "action": "Mehr Bewegung", "details": "..."}
    ],
    "immediate": [
      {"action": "Sofortige Maßnahme", "details": "..."}
    ]
  },
  "summary": "Zusammenfassung der Analyse"
}`;
  }
  
  buildPrompt(features) {
    return `Analysiere die folgenden Patientendaten (anonymisiert):

HARNSÄUREWERTE (letzte ${features.days || 30} Tage):
- Durchschnitt: ${features.uricAcidStats?.average || 0} mg/dL
- Minimum: ${features.uricAcidStats?.min || 0} mg/dL
- Maximum: ${features.uricAcidStats?.max || 0} mg/dL
- Anzahl Messungen: ${features.uricAcidStats?.count || 0}
- Gichtanfälle: ${features.goutAttacks || 0}

TRENDS:
${features.trends || 'Keine Trend-Daten verfügbar'}

ERNÄHRUNG (letzte ${features.days || 30} Tage):
- Durchschnittlicher täglicher Purin: ${features.dietStats?.avgPurin || 0} mg
- Durchschnittliche tägliche Kalorien: ${features.dietStats?.avgCalories || 0} kcal
- Durchschnittliches tägliches Protein: ${features.dietStats?.avgProtein || 0} g
- Anzahl Mahlzeiten: ${features.dietStats?.mealCount || 0}

FAKTOREN-HÄUFIGKEIT:
- Viel Fleisch: ${features.factorPercentages?.muchMeat || 0}% der Messungen
- Viel Sport: ${features.factorPercentages?.muchSport || 0}% der Messungen
- Viel Zucker: ${features.factorPercentages?.muchSugar || 0}% der Messungen
- Viel Alkohol: ${features.factorPercentages?.muchAlcohol || 0}% der Messungen
- Fasten: ${features.factorPercentages?.fasten || 0}% der Messungen

KORRELATIONEN:
${JSON.stringify(features.correlations || [], null, 2)}

MUSTER:
${JSON.stringify(features.patterns || [], null, 2)}

Bitte analysiere diese Daten und gib strukturierte Empfehlungen im angegebenen JSON-Format.`;
  }
  
  calculateConfidence(features) {
    let confidence = 0.5; // Base confidence
    
    // More data = higher confidence
    const measurementCount = features.uricAcidStats?.count || 0;
    if (measurementCount > 30) confidence += 0.2;
    else if (measurementCount > 10) confidence += 0.1;
    
    // More meals = higher confidence
    const mealCount = features.dietStats?.mealCount || 0;
    if (mealCount > 50) confidence += 0.2;
    else if (mealCount > 20) confidence += 0.1;
    
    // Clear patterns = higher confidence
    if (features.correlations && features.correlations.length > 0) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }
}

module.exports = new LLMService();

