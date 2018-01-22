#include <Adafruit_Fingerprint.h>
#include <string.h>
uint8_t id;
uint8_t idin = 0;
bool b1 = false;
char c = '0'; 
bool enrollw = false;
bool huella1 = false;
bool huella2 = false;
uint8_t getFingerprintEnroll();
int getFingerprintIDez();
int ledFinger = 2;
int ledFingerStatus = 3;
int ledEncendidoStart = 4;
int ledState = LOW;   
long previousMillis = 0;      
long interval = 50000;           
bool gpsvalida = true;
char separador[] = ",";
char *resultado = NULL;
char campos[20][15];


Adafruit_Fingerprint finger = Adafruit_Fingerprint(&Serial2);


void setup()  
{ 
  Serial.begin(9600);
  Serial1.begin(115200);
  pinMode(ledFinger, OUTPUT);
  pinMode(ledFingerStatus, OUTPUT);
  pinMode(ledEncendidoStart, OUTPUT);
  finger.begin(57600);
  digitalWrite(ledFinger,ledState);
  if (finger.verifyPassword()) {
    digitalWrite(ledFingerStatus,HIGH);
  } else {
    digitalWrite(ledFingerStatus,LOW);
    while (1);
  }
}

void loop(){

 unsigned long currentMillis = millis();
 if(currentMillis - previousMillis > interval) {
    previousMillis = currentMillis;   
    if (ledState == LOW){
        ledState = HIGH; 
        digitalWrite(ledFinger, ledState);
    }
  }
   idin = menu();
   switch (idin) {
      case 1:
      if(b1 == false){
        Serial.println("Registro");
        b1 = true;
      }
      
      id = readnumber();
      while (!getFingerprintEnroll() && enrollw == false);
      
      break;

      default:
      if(b1 == false){
        Serial.println("Ingreso");
        b1 = true;
        enrollw = false;
      }
     FinguerIdentifica();
        
   }
  delay(50);            
}
////Identifica el numero menu//////////
uint8_t menu(void) {
  uint8_t num = 0;
  boolean validnum = false; 
  if (Serial.available()){
    c = Serial.read();
    if (isdigit(c)) {
       num *= 10;
       num += c - '0';
       b1 = false;
       return num;
    } 
  }
}

uint8_t readnumber(void) {
  uint8_t num = 0;
  boolean validnum = false; 
  while (1) {
    if (Serial.available());
    char c = Serial.read();
    if (isdigit(c)) {
       num *= 10;
       num += c - '0';
       validnum = true;
    } else if (validnum) {
      return num;
    }
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
uint8_t getFingerprintID() {
  uint8_t p = finger.getImage();
  switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Tomando imagen");
      break;
    case FINGERPRINT_NOFINGER:
      Serial.println("Dedo no detectado");
      return p;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Error de comunicacion");
      return p;
    case FINGERPRINT_IMAGEFAIL:
      Serial.println("Error de imagen");
      return p;
    default:
      Serial.println("Error desconocido");
      return p;
  }

  

  p = finger.image2Tz();
  switch (p) {
    case FINGERPRINT_OK:
      Serial.println("Imagen convertida");
      break;
    case FINGERPRINT_IMAGEMESS:
      Serial.println("Imagen demaciado desordenada");
      return p;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Error de comunicacion");
      return p;
    case FINGERPRINT_FEATUREFAIL:
      Serial.println("No se pudieron encontrar las caracteristicas de la huella digital");
      return p;
    case FINGERPRINT_INVALIDIMAGE:
      Serial.println("No se pudieron encontrar las caracteristicas de la huella digital");
      return p;
    default:
      Serial.println("Error desconosido");
      return p;
  }
  
 
  p = finger.fingerFastSearch();
  if (p == FINGERPRINT_OK) {
    Serial.println("Se encontro una hella emparejada");
  } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
    Serial.println("Error de comunicacion");
    return p;
  } else if (p == FINGERPRINT_NOTFOUND) {
    Serial.println("No se encontro emparejada");
    return p;
  } else {
    Serial.println("Error desconocido");
    return p;
  }   
  
      // found a match!
  Serial.print("Se encontro ID #"); Serial.print(finger.fingerID); 
  Serial.print(" Con confianza de "); Serial.println(finger.confidence); 
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

int FinguerIdentifica() {
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK)  return -1;
  p = finger.image2Tz();
  if (p != FINGERPRINT_OK)  return -1;
  p = finger.fingerFastSearch();
  if (p != FINGERPRINT_OK)  return -1;
  asignacionname();
  return finger.fingerID; 
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
void asignacionname()
{
  String Ingps;
  int ID = 0;
  gpsvalida = true;
  ID = finger.fingerID;
  if (ID != 0  ) {
      String AT = "AT$TTGPSQRY=10";
      Serial1.println(AT);
      while((!Serial1.available()>0) && gpsvalida == true){
            Ingps = Serial1.readString();
            Ingps.replace("\n",",");
            Ingps.replace(":",",");
            Serial.println(Ingps);
            Serial.println();
            resultado = strtok(&Ingps[0],separador);
            int index = 0;
            while(resultado != NULL){
              strcpy(campos[index],resultado);
              index++;
              resultado = strtok(NULL,separador);
              }
           gpsvalida = false;
      }
       digitalWrite(ledEncendidoStart,HIGH);
       delay(50);
       String zero = "0,";
       String verifica = "verifica,";
       String imei = "862894020912211,";
       String idout = String(ID);
       String dataout = zero + verifica + imei + idout + "," + campos[5] + "," + campos [7] + "," + "1";  
       Serial.println(dataout);
       dataout.replace("\n",""); 
       Serial1.print("AT$TTSNDMG=4,");
       Serial1.write((byte)0x22);
       Serial1.print(dataout);
       Serial1.write((byte)0x22);
       Serial1.println();
       delay(50);
       Serial1.println("AT&W");
       delay(100);
       

  }
}
void(* Resetea) (void) = 0;
/////////enroll//////////////////////////////////////////////////////////////
uint8_t getFingerprintEnroll() {
  int p = -1;
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    switch (p) {
    case FINGERPRINT_OK:
      Serial.println("OK01"); // imagen tomada Ok
      break;
    case FINGERPRINT_NOFINGER:
      if(huella1 == false){
        Serial.println("IN01"); // No hay huella en el finguer
        huella1 = true;
      }
      break;
    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("ER02"); // Error en la comunicacion
      break;
    case FINGERPRINT_IMAGEFAIL:
      Serial.println("ER03"); // Error en la Imagen
      break;
    default:
      Serial.println("ER04"); // Error Desconocido
      break;
    }
  }

  // OK success!

      p = finger.image2Tz(1);
      switch (p) {
        case FINGERPRINT_OK:
        paso1();
         break;
        case FINGERPRINT_IMAGEMESS:
          //Serial.println("Image too messy");
          return p;
        case FINGERPRINT_PACKETRECIEVEERR:
          //Serial.println("Communication error");
          return p;
        case FINGERPRINT_FEATUREFAIL:
          //Serial.println("Could not find fingerprint features");
          return p;
        case FINGERPRINT_INVALIDIMAGE:
          //Serial.println("Could not find fingerprint features");
          return p;
        default:
          //Serial.println("Unknown error");
          return p;
      }


      p = finger.image2Tz(2);
      switch (p) {
        case FINGERPRINT_OK:
          //Serial.println("Image converted");
          break;
        case FINGERPRINT_IMAGEMESS:
          //Serial.println("Image too messy");
          return p;
        case FINGERPRINT_PACKETRECIEVEERR:
          //Serial.println("Communication error");
          return p;
        case FINGERPRINT_FEATUREFAIL:
          //Serial.println("Could not find fingerprint features");
          return p;
        case FINGERPRINT_INVALIDIMAGE:
          //Serial.println("Could not find fingerprint features");
          return p;
        default:
          //Serial.println("Unknown error");
          return p;
      }
  
  // OK converted!
  
      p = finger.createModel();
      if (p == FINGERPRINT_OK) {
        p = finger.storeModel(id);
      if (p == FINGERPRINT_OK) {
          String ok = "OK.";
          String okenv = ok + id;
          Serial.println(okenv);
          delay(100);
          enrollw = true;
          huella1 = false;
          huella2 = false;
          idin = 0;
          idin = menu();  
      } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
        Serial.println("EF1");//Error en la comunicacion
        return p;
      } else if (p == FINGERPRINT_BADLOCATION) {
        Serial.println("EF2");//No se pudo almacenar en esa ubicación
        return p;
      } else if (p == FINGERPRINT_FLASHERR) {
        Serial.println("EF3");//Error Escritura en memoria flash
        return p;
      } else {
        Serial.println("EF4"); // Error desconocido
        return p;
      }
      } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
        Serial.println("ERM1"); // Error Comunicacion
        return p;
      } else if (p == FINGERPRINT_ENROLLMISMATCH) {
        Serial.println("ERM2"); //Huellas Dactilares no coinciden
        return p;
      } else {
        Serial.println("ERM3"); // Error Desconocido
        return p;
      }   
      
      

}


void paso1() {
       delay(100);
       int p = 0;
        while (p != FINGERPRINT_NOFINGER) {
          p = finger.getImage();
        }
        p = -1;
        while (p != FINGERPRINT_OK) {
          p = finger.getImage();
          switch (p) {
          case FINGERPRINT_OK:
            Serial.println("OK11"); // Imagen Tomada
            break;
          case FINGERPRINT_NOFINGER:
            if(huella2 == false){
              Serial.println("IN11"); // No hay Huella en el dispositivo
              huella2 = true;
            }
            break;
          case FINGERPRINT_PACKETRECIEVEERR:
            Serial.println("ER12"); // Error en la comunicacion
            break;
          case FINGERPRINT_IMAGEFAIL:
            Serial.println("ER13"); // Error en la Imagen
            break;
          default:
            Serial.println("ER14"); // Error desconocido
            break;
          }
        }
}


































/*void setup() {
  // Open serial communications and wait for port to open:
  Serial.begin(115200);
  Serial1.begin(115200);

}

void loop() { // run over and over
  if (Serial.available()) {
      String valor = Serial.readString();
      Serial1.println(valor);    
  }
  
   if (Serial1.available()) {
    Serial.print(Serial1.readString());
  }
}*/
