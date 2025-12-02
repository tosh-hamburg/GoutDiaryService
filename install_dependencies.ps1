# PowerShell Script zum Installieren der Dependencies über SSH
# Benötigt: ssh.exe (normalerweise in Windows 10/11 enthalten)

$hostname = "192.68.4.59"
$username = "adm_ssh"
$password = "tosh&123"
$command = "cd /volume1/nodejs/UricAcidService && npm install express-session passport passport-google-oauth20"

# Erstelle temporäre Datei für SSH-Befehl
$tempScript = [System.IO.Path]::GetTempFileName()
$scriptContent = @"
#!/bin/bash
cd /volume1/nodejs/UricAcidService
npm install express-session passport passport-google-oauth20
"@
$scriptContent | Out-File -FilePath $tempScript -Encoding ASCII

Write-Host "Verbinde mit SSH..."
Write-Host "Bitte Passwort eingeben wenn gefragt: tosh&123"

# Versuche SSH-Verbindung
ssh ${username}@${hostname} "bash -s" < $tempScript

# Lösche temporäre Datei
Remove-Item $tempScript

Write-Host "Fertig!"










