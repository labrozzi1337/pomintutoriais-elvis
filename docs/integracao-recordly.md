# Recordly e integração Windows

## O que foi comprovado em 09/10/2026

Instalação local: Recordly **1.4.0**, executável em `%LOCALAPPDATA%\Programs\Recordly\Recordly.exe`. Auditoria da tag oficial `v1.4.0`, commit `4b20a1a76ed3564bd70aee7a0cc7167ea2e5e9c1`.

| Evidência | Resultado |
| --- | --- |
| `electron/main.ts`, `electron-builder.json5` e registros de protocolo locais | Não foi encontrado protocolo nativo documentado para iniciar gravação. Não usamos `recordly://gravar`. |
| `src/components/video-editor/ExtensionManager.tsx` | A versão estável informa que extensões não estão disponíveis. |
| `EXTENSIONS.md` versus código real | A documentação cita `export:complete`, mas a busca no código desta tag não encontrou sua implementação. Não é base suficiente para upload automático. |
| `src/components/video-editor/export/exportPersistence.ts`, `electron/preload.ts`, `electron/ipc/register/export.ts` | Exportação usa gravação/finalização local de arquivo. O MVP exige exportar MP4 e importar no portal. |

Fontes oficiais: [releases](https://github.com/webadderallorg/Recordly/releases), [gerenciador de extensões](https://github.com/webadderallorg/Recordly/blob/v1.4.0/src/components/video-editor/ExtensionManager.tsx), [persistência da exportação](https://github.com/webadderallorg/Recordly/blob/v1.4.0/src/components/video-editor/export/exportPersistence.ts), [licença](https://github.com/webadderallorg/Recordly/blob/v1.4.0/LICENSE.md). Verifique novamente ao atualizar o Recordly.

O Recordly é AGPLv3; nosso pacote de integração não contém código ou binários do Recordly. Uma extensão/fork requer revisão específica de licença e marca, além de comprovação técnica. Não redistribuímos o Recordly.

## Instalar e abrir

1. No Windows, entre em `http://localhost:8081` e clique em **Abrir Recordly**.
2. Confirme a pergunta do navegador para abrir o aplicativo externo.
3. Se a abertura não responder, o portal mostra **Baixar Recordly**.
4. Grave/edite no Recordly, exporte MP4 e importe no portal.

Não há código, conta, dispositivo ou pareamento. A migration `20261009210000_launcher_windows.sql` pertence ao fluxo anterior e não é necessária para abrir o Recordly.

## Comportamento verdadeiro

O navegador solicita a abertura de `estudiotutoriais://abrir`, e o registro do Windows aponta diretamente para o `Recordly.exe` já instalado. Não existe outro executável entre o botão e o Recordly. Como o navegador não fornece uma API para consultar programas instalados, o portal considera a perda de foco/visibilidade como abertura bem-sucedida e mostra o download somente quando a tentativa não responde.

Abrir o Recordly não inicia a captura nem escolhe o destino da exportação. A versão oficial auditada não oferece protocolo ou callback suportado para salvar automaticamente no portal; o MP4 deve ser exportado e importado.

## Segurança e remoção

O botão usa somente `estudiotutoriais://abrir`; o comando registrado não repassa query, paths, argumentos ou scripts ao Recordly. A confirmação para abrir o aplicativo externo pertence ao navegador/Windows. Nenhuma chave ou credencial do portal é usada.

Há consentimento explícito antes de iniciar o `.exe`, nenhuma elevação e nenhuma instalação silenciosa. A verificação de caminho/metadados não substitui Authenticode nem protege um Windows já comprometido. Assinatura digital é pendência para distribuição externa.

Para remover, execute `powershell -NoProfile -File .\Remover.ps1` na pasta extraída. O script remove somente o protocolo e resíduos do launcher antigo; preserva Recordly e projetos.

Para recompilar: `powershell -NoProfile -File .\launcher-windows\Compilar.ps1`. Saída: `artifacts/launcher/EstudioTutoriais-Launcher.zip`; uma cópia vai para o download do frontend. Recompile antes de gerar a imagem Docker em uma máquina limpa.

SHA-256 do pacote gerado nesta entrega: `E73C083FB7BE6C4A3060AB3A0D8D4F0B2B525D1908A6ACEBBC7F62757CF811D8`. Uma recompilação pode mudar o hash; o administrador deve divulgar o hash do pacote que realmente distribuir.

## Aceite pendente

Geração do pacote, detecção do Recordly e registro direto do protocolo passaram nesta máquina. **A abertura visível pelo clique, cancelamento da confirmação do navegador, cenário sem Recordly e instalação em outra máquina ainda exigem teste interativo**.
