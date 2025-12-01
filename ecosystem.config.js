// ecosystem.config.js
module.exports = {
  apps : [{
    name   : "GoutDiaryService",
    script : "npm",
    args   : "run dev", 
    
    // 💡 NEU: PM2 lädt alle Variablen aus dieser Datei
    env_file: ".env",
  }]
};