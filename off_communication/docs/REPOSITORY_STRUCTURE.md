# Estrutura do repositório

```text
off_communication/
├── README.md
├── pubspec.yaml
├── analysis_options.yaml
├── android/ ios/                    # projetos nativos gerados + permissões
├── docs/
│   ├── TECHNICAL_ARCHITECTURE.md
│   ├── DECISIONS.md                 # ADRs (ADR-005 = rede híbrida)
│   ├── FASE_A_RELATORIO.md
│   ├── PLATFORM_SETUP.md
│   └── CLAUDE_MASTER_PROMPT.md
├── lib/
│   ├── main.dart
│   ├── app/                         # MaterialApp, tema, cores
│   ├── core/config/                 # LanConfig
│   ├── communication/
│   │   ├── contracts/               # CommunicationTransport (interface comum)
│   │   ├── coordinator/             # ConnectivityCoordinator (escolha de rota)
│   │   ├── protocol/                # MeshPacket (envelope versionado)
│   │   └── transports/
│   │       ├── lan/                 # UdpLanTransport (experimental)
│   │       └── online/              # OnlineTransport (stub, Fase C)
│   ├── data/local/                  # contratos: identidade, mensagens, vistos
│   ├── features/
│   │   ├── channels/                # canais + repositório de demonstração
│   │   ├── home/                    # tela "Minha comunicação"
│   │   ├── network_status/          # card ONLINE/MESH + simulação (Fase A)
│   │   └── ptt/                     # PttController + PttButton
│   └── platform/audio/              # contratos de captura/codec/saída
├── supabase/migrations/
└── test/
```

Pastas previstas no prompt mestre e ainda não criadas (entram quando houver
código): `communication/mesh/`, `communication/store_forward/`,
`transports/direct_android/`, `transports/direct_ios/`, `platform/background/`,
`platform/permissions/`, `data/remote/`, `integration_test/`.

Regra: widgets nunca acessam sockets; falam com controladores, que falam com
o coordenador e com `CommunicationTransport`.
