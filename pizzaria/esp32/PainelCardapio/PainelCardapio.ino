// Painel de cardápio em tela LCD com ESP32.
//
// Lê do Supabase o resumo que a área da loja publica para esta tela
// (chave "pz:painel:<TELA_ID>") e passa as páginas do cardápio. Se a tela
// estiver marcada para isso, mostra também as senhas de pedidos prontos
// (chave "pz:prontos"). Tudo vem sem acentos e com os preços já formatados,
// porque as fontes internas da TFT_eSPI só têm ASCII.
//
// Bibliotecas: TFT_eSPI (Bodmer) e ArduinoJson 7.

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <TFT_eSPI.h>
#include "config.h"

#ifndef ROTACAO
#define ROTACAO 1
#endif

const uint32_t ATUALIZA_CARDAPIO_MS = 60UL * 1000;  // busca o cardápio a cada 1 min
const uint32_t ATUALIZA_PRONTOS_MS  = 8UL * 1000;   // senhas prontas a cada 8 s

TFT_eSPI tft;
JsonDocument painel;   // último cardápio recebido
JsonDocument prontos;  // últimas senhas prontas
bool temPainel = false;
bool ultimaFalhou = false;

uint16_t COR_FUNDO, COR_TOPO, COR_OURO, COR_TEXTO, COR_SUAVE, COR_VERDE, COR_LINHA;

int pagina = 0;
uint32_t proximaPagina = 0, proximoCardapio = 0, proximosProntos = 0;

// ---------- Rede ----------

void conectarWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_SENHA);
  uint32_t inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 15000) delay(250);
}

// Busca o "value" de uma chave da tabela app_storage. Devolve "" se falhar.
String lerChave(const String& chave) {
  conectarWifi();
  if (WiFi.status() != WL_CONNECTED) return "";

  WiFiClientSecure cliente;
  // A chave anon já é pública (é a mesma do site). Para validar o
  // certificado, troque por cliente.setCACert(<certificado raiz>).
  cliente.setInsecure();

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/app_storage?select=value&key=eq." + chave;
  if (!http.begin(cliente, url)) return "";
  http.addHeader("apikey", SUPABASE_CHAVE);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_CHAVE);
  http.setTimeout(10000);

  String valor = "";
  int codigo = http.GET();
  if (codigo == 200) {
    JsonDocument resposta;
    if (!deserializeJson(resposta, http.getStream()) && resposta.size() > 0) {
      valor = resposta[0]["value"].as<String>();
    }
  } else {
    Serial.printf("HTTP %d em %s\n", codigo, chave.c_str());
  }
  http.end();
  return valor;
}

bool atualizarCardapio() {
  String v = lerChave(String("pz:painel:") + TELA_ID);
  if (v.length() == 0) return false;
  JsonDocument novo;
  if (deserializeJson(novo, v)) return false;
  painel = novo;
  temPainel = true;
  return true;
}

bool atualizarProntos() {
  String v = lerChave("pz:prontos");
  if (v.length() == 0) return false;
  JsonDocument novo;
  if (deserializeJson(novo, v)) return false;
  prontos = novo;
  return true;
}

// ---------- Desenho ----------

// Corta o texto para caber na largura, terminando em "..".
String caber(String s, int largura, int fonte) {
  if (tft.textWidth(s, fonte) <= largura) return s;
  while (s.length() > 1 && tft.textWidth(s + "..", fonte) > largura) s.remove(s.length() - 1);
  return s + "..";
}

void mensagem(const char* titulo, const char* detalhe) {
  tft.fillScreen(COR_FUNDO);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(COR_OURO, COR_FUNDO);
  tft.drawString(titulo, tft.width() / 2, tft.height() / 2 - 14, 4);
  tft.setTextColor(COR_SUAVE, COR_FUNDO);
  tft.drawString(detalhe, tft.width() / 2, tft.height() / 2 + 16, 2);
}

int larguraProntos() {
  return (temPainel && painel["prontos"].as<int>() == 1) ? tft.width() * 27 / 100 : 0;
}

void desenharProntos(int topo, int base) {
  int lp = larguraProntos();
  if (!lp) return;
  int x = tft.width() - lp;
  tft.fillRect(x, topo, lp, base - topo, COR_LINHA);
  tft.setTextDatum(TC_DATUM);
  tft.setTextColor(COR_VERDE, COR_LINHA);
  tft.drawString("PRONTO!", x + lp / 2, topo + 6, 2);

  JsonArray lista = prontos["l"].as<JsonArray>();
  int fonte = tft.width() >= 480 ? 4 : 4;
  int y = topo + 28;
  int i = 0;
  for (JsonVariant s : lista) {
    if (y + tft.fontHeight(fonte) > base) break;
    tft.setTextColor(i == 0 ? COR_OURO : COR_TEXTO, COR_LINHA);
    tft.drawString(s.as<String>(), x + lp / 2, y, fonte);
    y += tft.fontHeight(fonte) + 4;
    i++;
  }
  if (i == 0) {
    tft.setTextColor(COR_SUAVE, COR_LINHA);
    tft.drawString("-", x + lp / 2, y, 4);
  }
}

void desenharPagina() {
  int W = tft.width(), H = tft.height();
  bool grande = W >= 480;
  int fNome = grande ? 4 : 2;   // fonte 2 = 16 px, fonte 4 = 26 px
  int fPreco = grande ? 4 : 2;
  int fDesc = grande ? 2 : 1;

  JsonArray paginas = painel["pag"].as<JsonArray>();
  int total = paginas.size();
  if (total == 0) { mensagem(painel["loja"] | "Cardapio", "Sem produtos nesta tela"); return; }
  if (pagina >= total) pagina = 0;
  JsonObject pg = paginas[pagina];

  tft.fillScreen(COR_FUNDO);

  // Topo: nome da loja e página
  int hTopo = grande ? 40 : 26;
  tft.fillRect(0, 0, W, hTopo, COR_TOPO);
  tft.setTextColor(TFT_WHITE, COR_TOPO);
  tft.setTextDatum(ML_DATUM);
  tft.drawString(caber(painel["loja"].as<String>(), W - 70, grande ? 4 : 2), 8, hTopo / 2, grande ? 4 : 2);
  tft.setTextDatum(MR_DATUM);
  tft.drawString(String(pagina + 1) + "/" + String(total), W - 8, hTopo / 2, 2);
  if (ultimaFalhou) tft.fillCircle(W - 52, hTopo / 2, 4, TFT_YELLOW);  // sem conexão: mostra o último cardápio

  // Rodapé: uma promoção por página
  JsonArray promos = painel["promo"].as<JsonArray>();
  int hRodape = promos.size() ? (grande ? 30 : 20) : 0;
  if (hRodape) {
    tft.fillRect(0, H - hRodape, W, hRodape, COR_VERDE);
    tft.setTextColor(TFT_WHITE, COR_VERDE);
    tft.setTextDatum(ML_DATUM);
    String promo = "* " + promos[pagina % promos.size()].as<String>();
    tft.drawString(caber(promo, W - 16, 2), 8, H - hRodape / 2, 2);
  }

  int areaW = W - larguraProntos();
  int y = hTopo + 6;

  // Categoria
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COR_OURO, COR_FUNDO);
  tft.drawString(pg["t"].as<String>(), 8, y, 4);
  y += tft.fontHeight(4) + 2;

  // Itens: nome à esquerda, preço à direita. Se não couberem na mesma
  // linha (vários tamanhos), o preço desce para a linha de baixo.
  int limite = H - hRodape - 2;
  for (JsonObject it : pg["i"].as<JsonArray>()) {
    String nome = it["n"].as<String>();
    String preco = it["p"].as<String>();
    String desc = it["d"] | "";
    bool promo = it["o"].as<int>() == 1;
    int wPreco = tft.textWidth(preco, fPreco);
    int hNome = tft.fontHeight(fNome);
    bool umaLinha = tft.textWidth(nome, fNome) + wPreco + 24 <= areaW;
    int alturaItem = hNome + (umaLinha ? 0 : tft.fontHeight(fPreco)) + (desc.length() ? tft.fontHeight(fDesc) : 0) + 6;
    if (y + alturaItem > limite) break;

    tft.setTextColor(COR_TEXTO, COR_FUNDO);
    tft.setTextDatum(TL_DATUM);
    tft.drawString(caber(nome, umaLinha ? areaW - wPreco - 24 : areaW - 16, fNome), 8, y, fNome);
    tft.setTextColor(promo ? TFT_ORANGE : COR_OURO, COR_FUNDO);
    tft.setTextDatum(TR_DATUM);
    if (umaLinha) {
      tft.drawString(preco, areaW - 8, y, fPreco);
      y += hNome;
    } else {
      y += hNome;
      tft.drawString(caber(preco, areaW - 16, fPreco), areaW - 8, y, fPreco);
      y += tft.fontHeight(fPreco);
    }
    if (desc.length()) {
      tft.setTextColor(COR_SUAVE, COR_FUNDO);
      tft.setTextDatum(TL_DATUM);
      tft.drawString(caber(desc, areaW - 16, fDesc), 8, y, fDesc);
      y += tft.fontHeight(fDesc);
    }
    y += 3;
    tft.drawFastHLine(8, y, areaW - 16, COR_LINHA);
    y += 3;
  }

  desenharProntos(hTopo, H - hRodape);
}

// ---------- Programa ----------

void setup() {
  Serial.begin(115200);
  tft.init();
  tft.setRotation(ROTACAO);
#ifdef TFT_BL
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, TFT_BACKLIGHT_ON);
#endif
  COR_FUNDO = tft.color565(22, 37, 29);    // verde forno
  COR_TOPO  = tft.color565(212, 65, 42);   // tomate
  COR_OURO  = tft.color565(240, 185, 74);  // borda da pizza
  COR_TEXTO = TFT_WHITE;
  COR_SUAVE = tft.color565(160, 175, 165);
  COR_VERDE = tft.color565(46, 122, 72);
  COR_LINHA = tft.color565(33, 54, 42);

  mensagem("Conectando...", WIFI_SSID);
  conectarWifi();
  if (WiFi.status() != WL_CONNECTED) mensagem("Sem Wi-Fi", "Confira nome e senha no config.h");
}

void loop() {
  uint32_t agora = millis();

  if ((int32_t)(agora - proximoCardapio) >= 0) {
    ultimaFalhou = !atualizarCardapio();
    proximoCardapio = agora + (ultimaFalhou ? 15000 : ATUALIZA_CARDAPIO_MS);
    if (!temPainel) {
      mensagem("Aguardando cardapio", "Cadastre a tela na area da loja");
    } else if (proximaPagina == 0) {
      proximaPagina = agora;  // primeira vez: desenha já
    }
  }

  if (temPainel && painel["prontos"].as<int>() == 1 && (int32_t)(agora - proximosProntos) >= 0) {
    if (atualizarProntos()) desenharProntos(tft.width() >= 480 ? 40 : 26, tft.height() - (painel["promo"].size() ? (tft.width() >= 480 ? 30 : 20) : 0));
    proximosProntos = agora + ATUALIZA_PRONTOS_MS;
  }

  if (temPainel && proximaPagina && (int32_t)(agora - proximaPagina) >= 0) {
    desenharPagina();
    pagina++;
    int seg = painel["seg"] | 10;
    proximaPagina = agora + (uint32_t)seg * 1000;
  }

  delay(50);
}
