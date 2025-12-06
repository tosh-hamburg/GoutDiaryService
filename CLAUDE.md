Backend-Service für die App 'Gout Diary'. 
Achtung: Alle Verbindungen müssen verschlüsselt sein, kein Bestandteil des Service darf unverschlüsselte Daten übertragen.
Der Code liegt auf einer Freigabe einer Synology, auf der Node.js läuft. Adresse der Synology: 192.168.4.59. Per SSH zu erreichen auf Port 22
Aus Sicht der Synology liegen die Daten auf /volume1/nodejs/goutdiary, aus Sicht des lokalen Entwicklungsrechners auf W:\
Die verwendete development domain ist: https://dev.gout-diary.com:3001