# Configuração nativa para testes

Execute `flutter create . --platforms=android,ios` antes de editar os manifests.

## Android — `android/app/src/main/AndroidManifest.xml`

Adicionar dentro de `<manifest>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

Para a primeira prova LAN, `INTERNET` é o nome histórico da permissão de sockets; não significa que o app precise acessar a internet. Solicitar microfone em runtime antes de implementar captura de áudio.

## iOS — `ios/Runner/Info.plist`

Adicionar:

```xml
<key>NSLocalNetworkUsageDescription</key>
<string>O OFF Communication usa a rede local para conectar aparelhos próximos sem internet.</string>
<key>NSMicrophoneUsageDescription</key>
<string>O OFF Communication precisa do microfone para transmitir mensagens de voz.</string>
```

O uso de Bonjour/multicast pode exigir declarações adicionais e configuração de entitlement conforme a implementação final. Validar em aparelho físico e nas versões mínimas de iOS escolhidas.

## Teste de rede

- Usar roteador portátil sem cabo WAN ou modem.
- Desativar isolamento de clientes (AP/client isolation).
- Conectar os dois telefones ao mesmo SSID.
- Confirmar que ambos recebem endereço IPv4 na mesma sub-rede.
- Testar unicast primeiro; depois broadcast/multicast.
- Registrar modelo do aparelho, versão do SO, latência, perda de pacotes e duração de bateria.
