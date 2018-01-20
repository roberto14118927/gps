 #include <ESP8266WebServer.h>
#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>
#include <WiFiUdp.h>
#include <WiFiClient.h>
#include <WiFiServer.h>
#include <Wire.h>
#define SOCK 1

WiFiClient client;
ESP8266WebServer server(80);

const char WiFiAPPSK[] = "12345678";
bool isSocketConnect = false;
float humidity, temp_f;  // Values read from sensor
unsigned long previousMillis = 0;        // will store last temp was read
const long interval = 2000;              // interval at which to read sensor
int conteo = 0;
int statu = 6;
int Minu = 1;
String Get = "";
const char * host = "192.168.1.69";//http://cooldriver.ddns.net
//const char * host = "192.168.1.71";
bool Status = false;
bool Minutos = false;
String dato = "";
bool Estatus = false;
unsigned int angle[300];
String buffe;
String dbHoras = "bdHoras.txt";
unsigned int Horas[10];
int HoraIni = 255;
int MinutoIni = 255;
int HoraFin = 255;
int MinutoFin = 255;
bool EstatusIni = false;
bool EstatusFin = false;

int Dia = 0;
bool EstatusDia = false;
String Mac = "";
bool Pir = false;
int pirconteo = 0;
bool Virtual = false;

String SSIDNOW = "";
String PASSNOW = "";
int conta = 0;
String SSIDW = "";
String PASSWORDW = "";
int Tiempo = 0;

unsigned long timeout = millis();
void setup() {
  Serial.begin(115200);
  delay(1000);
  //WiFi.mode(WIFI_STA);
  WiFi.begin("GUZMANRUIZ","Guzmanruiz141189");
}


void loop() {
  const int httpPort = 3000;
  while (WiFi.status() != WL_CONNECTED) {
    Serial.println("Conectado");
    isSocketConnect = false;
    delay(10);
  }

  while (isSocketConnect != true) {
    isSocketConnect = client.connect(host, httpPort);
    client.print(WiFi.macAddress() + ".0");
    client.flush();
    delay(10);
  }

  if (client.connected()) {
    if (client.available() > 0 && Status == false) {
      dato = client.readStringUntil('\n');
      Serial.println(dato);
    }

    
    if (millis() - timeout > 5000) {
        client.print(WiFi.macAddress() + ".1");
        client.flush();
        timeout = millis();
    }
  }

}














