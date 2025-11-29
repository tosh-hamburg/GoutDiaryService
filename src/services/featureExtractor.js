const UricAcidValue = require('../models/UricAcidValue');
const Meal = require('../models/Meal');
const logger = require('../utils/logger');

class FeatureExtractor {
  async extractFeatures(userId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Get data
      const uricAcidValues = UricAcidValue.findByUserId(userId, {
        startDate: startDate.toISOString()
      });
      
      const meals = Meal.findByUserId(userId, {
        startDate: startDate.toISOString()
      });
      
      // Calculate statistics
      const uricAcidStats = UricAcidValue.getStats(userId, days);
      const dietStats = Meal.getDietStats(userId, days);
      
      // Calculate trends
      const trends = this.calculateTrends(uricAcidValues);
      
      // Calculate factor percentages
      const factorPercentages = this.calculateFactorPercentages(uricAcidValues);
      
      // Find correlations
      const correlations = this.findCorrelations(uricAcidValues);
      
      // Detect patterns
      const patterns = this.detectPatterns(uricAcidValues, meals);
      
      return {
        days,
        uricAcidStats,
        goutAttacks: uricAcidStats.goutAttacks,
        trends,
        dietStats,
        factorPercentages,
        correlations,
        patterns
      };
    } catch (error) {
      logger.error('Feature extraction error:', error);
      throw error;
    }
  }
  
  calculateTrends(values) {
    if (!values || values.length < 2) {
      return 'Nicht genügend Daten für Trend-Analyse';
    }
    
    // Sort by timestamp
    const sorted = [...values].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    // Simple linear trend
    const n = sorted.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    sorted.forEach((value, index) => {
      const x = index;
      const y = value.value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgValue = sumY / n;
    
    if (slope > 0.1) {
      return `Steigender Trend (${slope.toFixed(3)} mg/dL pro Messung)`;
    } else if (slope < -0.1) {
      return `Fallender Trend (${slope.toFixed(3)} mg/dL pro Messung)`;
    } else {
      return `Stabiler Trend (Durchschnitt: ${avgValue.toFixed(2)} mg/dL)`;
    }
  }
  
  calculateFactorPercentages(values) {
    if (!values || values.length === 0) {
      return {
        muchMeat: 0,
        muchSport: 0,
        muchSugar: 0,
        muchAlcohol: 0,
        fasten: 0
      };
    }
    
    const total = values.length;
    const factors = {
      muchMeat: 0,
      muchSport: 0,
      muchSugar: 0,
      muchAlcohol: 0,
      fasten: 0
    };
    
    values.forEach(value => {
      if (value.muchMeat) factors.muchMeat++;
      if (value.muchSport) factors.muchSport++;
      if (value.muchSugar) factors.muchSugar++;
      if (value.muchAlcohol) factors.muchAlcohol++;
      if (value.fasten) factors.fasten++;
    });
    
    return {
      muchMeat: Math.round((factors.muchMeat / total) * 100),
      muchSport: Math.round((factors.muchSport / total) * 100),
      muchSugar: Math.round((factors.muchSugar / total) * 100),
      muchAlcohol: Math.round((factors.muchAlcohol / total) * 100),
      fasten: Math.round((factors.fasten / total) * 100)
    };
  }
  
  findCorrelations(values) {
    if (!values || values.length < 5) {
      return [];
    }
    
    const correlations = [];
    const factors = ['muchMeat', 'muchSport', 'muchSugar', 'muchAlcohol', 'fasten'];
    
    factors.forEach(factor => {
      const factorValues = values.map(v => v[factor] ? 1 : 0);
      const uricAcidValues = values.map(v => v.value);
      
      const correlation = this.calculateCorrelation(factorValues, uricAcidValues);
      
      if (Math.abs(correlation) > 0.2) { // Significant correlation
        correlations.push({
          factor: this.getFactorName(factor),
          correlation: parseFloat(correlation.toFixed(2)),
          description: this.describeCorrelation(factor, correlation)
        });
      }
    });
    
    return correlations;
  }
  
  calculateCorrelation(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }
  
  detectPatterns(uricAcidValues, meals) {
    const patterns = [];
    
    if (!uricAcidValues || uricAcidValues.length < 7) {
      return patterns;
    }
    
    // Weekend pattern
    const weekendValues = uricAcidValues
      .filter(v => {
        const day = new Date(v.timestamp).getDay();
        return day === 0 || day === 6; // Sunday or Saturday
      })
      .map(v => v.value);
    
    const weekdayValues = uricAcidValues
      .filter(v => {
        const day = new Date(v.timestamp).getDay();
        return day !== 0 && day !== 6;
      })
      .map(v => v.value);
    
    if (weekendValues.length > 0 && weekdayValues.length > 0) {
      const weekendAvg = weekendValues.reduce((a, b) => a + b, 0) / weekendValues.length;
      const weekdayAvg = weekdayValues.reduce((a, b) => a + b, 0) / weekdayValues.length;
      
      if (weekendAvg > weekdayAvg * 1.1) {
        patterns.push({
          pattern: 'Wochenend-Effekt',
          description: `Höhere Harnsäurewerte am Wochenende (${weekendAvg.toFixed(2)} vs ${weekdayAvg.toFixed(2)} mg/dL)`
        });
      }
    }
    
    return patterns;
  }
  
  getFactorName(factor) {
    const names = {
      muchMeat: 'Fleischkonsum',
      muchSport: 'Sport',
      muchSugar: 'Zuckerkonsum',
      muchAlcohol: 'Alkoholkonsum',
      fasten: 'Fasten'
    };
    return names[factor] || factor;
  }
  
  describeCorrelation(factor, correlation) {
    const factorName = this.getFactorName(factor);
    const direction = correlation > 0 ? 'positiv' : 'negativ';
    const strength = Math.abs(correlation) > 0.6 ? 'starke' : 
                    Math.abs(correlation) > 0.4 ? 'moderate' : 'schwache';
    
    return `${strength} ${direction}e Korrelation zwischen ${factorName} und Harnsäurewerten`;
  }
}

module.exports = new FeatureExtractor();


