// Copie este arquivo para config.h e preencha.
// A área da loja (Telas e TV -> Configurar ESP32) mostra estes valores prontos.
#pragma once

#define WIFI_SSID       "nome-da-rede"
#define WIFI_SENHA      "senha-da-rede"

// Supabase -> Project Settings -> API
#define SUPABASE_URL    "https://SEU-PROJETO.supabase.co"
#define SUPABASE_CHAVE  "cole-aqui-a-anon-public-key"

// ID da tela cadastrada em "Telas e TV" (ex.: balcao-pizzas)
#define TELA_ID         "balcao-pizzas"

// Gira a tela: 1 ou 3 = deitada (paisagem), 0 ou 2 = em pé (retrato)
#define ROTACAO         1
