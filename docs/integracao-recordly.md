# Recordly e abertura pelo navegador

O portal faz uma única tentativa, iniciada pelo clique do usuário, de abrir `estudiotutoriais://abrir`. A página permanece no mesmo passo. Se o navegador perder o foco porque o aplicativo respondeu, o download não é exibido; se não houver resposta em 2,5 segundos, são mostrados os downloads oficiais do Recordly 1.4.0 para Windows, macOS e Linux.

No Windows, o fallback informa o caminho padrão `%LOCALAPPDATA%\Programs\Recordly\Recordly.exe` e orienta quem já instalou a abrir o Recordly pelo menu Iniciar, gravar, exportar em MP4 e voltar ao portal para enviar o arquivo. A opção **Tentar abrir Recordly novamente** repete somente a solicitação de protocolo.

Não distribuímos launcher, ZIP, script PowerShell ou código do Recordly. O MP4 continua sendo exportado no Recordly e importado manualmente no portal.

## Limitação da versão oficial

Um site não pode consultar executáveis instalados nem registrar uma associação de protocolo no sistema operacional. Essa associação precisa ser criada pelo instalador do aplicativo. A configuração oficial do Recordly 1.4.0 não declara um protocolo de URL; portanto, instalar somente essa versão não garante que o Windows saiba abrir `estudiotutoriais://`.

O diálogo **Abrir Recordly?** prova que existe uma associação na máquina, não que o navegador tenha detectado o aplicativo. Na máquina em que uma associação antiga já existe, o diálogo continuará aparecendo. Em uma máquina nova, o comportamento solicitado só pode ser garantido quando o próprio instalador oficial do Recordly registrar um protocolo e o portal passar a usar esse esquema.

Fontes oficiais verificadas: [release 1.4.0](https://github.com/webadderallorg/Recordly/releases/tag/v1.4.0), [configuração do instalador](https://github.com/webadderallorg/Recordly/blob/v1.4.0/electron-builder.json5) e [documentação de protocolos do Electron](https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app).
