#include <ESP8266WiFi.h>
#include <ESP8266WiFiMulti.h>
WiFiClient client;
ESP8266WiFiMulti WiFiMulti;
bool isSocketConnect = false;

void setup() {
    Serial.begin(115200);
    delay(10);

    // We start by connecting to a WiFi network
    WiFiMulti.addAP("PLANEACION2", "Upgchtech2");

    Serial.println();
    Serial.println();
    Serial.print("Wait for WiFi... ");

    while(WiFiMulti.run() != WL_CONNECTED) {
        Serial.print(".");
        delay(500);
    }

    Serial.println("");
    Serial.println("WiFi connected");
    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.println(WiFi.macAddress());

    delay(500);
}


void loop() {
    const int httpPort = 3333;
    const char * host = "10.10.2.96"; // ip or dns

    while (WiFi.status() != WL_CONNECTED) {
      isSocketConnect = false;
      delay(10);
    }

    while (isSocketConnect != true) {
      isSocketConnect = client.connect(host, httpPort);
      client.print(WiFi.macAddress() + ".0");
      //client.flush();
      delay(10);
    }
    if (client.connected()) {
        
      if (client.available() > 0) {
           //Serial.println("Llego algo");
           String dato = client.readStringUntil('\n');
           Serial.println(dato);
      }
     client.print("Conectado");
      delay(1000);
    }
}