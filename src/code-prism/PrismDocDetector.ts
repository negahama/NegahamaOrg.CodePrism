import * as vscode from 'vscode'

import { PrismPath } from './PrismPath'
import { PrismManager } from './PrismManager'
import { PrismFileSystem } from './PrismFileSystem'

export namespace PrismDocDetector {
  /**
   * Represents a document that is linked with a URI and its content.
   *
   * @typedef {Object} LinkedDoc
   * @property {vscode.Uri} uri - The URI of the linked document.
   * @property {string} content - The content of the linked document.
   */
  type LinkedDoc = {
    uri: vscode.Uri
    content: string
  }

  const linkedFilesMap: Map<string, string[]> = new Map()

  /**
   * 현재 방식은 처음 참조될 때 검색하고 저장했다가 다음에 참조될 때는 저장된 값을 사용하는 방식이다.
   * 이 방식은 이미 참조되어진 후에 변경되면 변경 내용이 반영이 되지는 않는 문제가 있기 때문에
   * 새로 document를 만드는 경우에는 이 함수를 호출하여 linkedFilesMap을 초기화해주어야 한다.
   */
  export function clear() {
    linkedFilesMap.clear()
  }

  /**
   * Activates the document detector extension.
   *
   * This function initializes the document detector by setting up the necessary
   * storage, detecting the documentation folder, and registering hover and command
   * providers. It also sets up event listeners to handle document saves and updates.
   *
   * @param context - The extension context provided by VSCode.
   *
   * The function performs the following tasks:
   * - Initializes the local storage service with the workspace state.
   * - Detects the documentation folder and updates the stored documentation values.
   * - Registers a hover provider to show documentation links and content on hover.
   * - Registers a command to open the related documentation for the active text editor.
   * - Sets up an event listener to re-link documentation when a document in the prism's docs folder is saved.
   */
  export async function activate(context: vscode.ExtensionContext) {
    /**
     * Retrieves information about documents linked to a given source file.
     *
     * @param uri - The URI of the source file for which to find linked documents.
     * @returns An array of `LinkedDoc` objects containing the URI and content of each linked document.
     *
     * @remarks
     * This function scans through all the issues and descriptions managed by `PrismManager` to find links to other files.
     * It then filters these links to find those associated with the provided source file URI.
     * The linked documents' URIs are adjusted if they are relative paths, and their content is retrieved.
     */
    const getLinkedDocInfo = async (uri: vscode.Uri): Promise<LinkedDoc[]> => {
      const linkedFiles: string[] = linkedFilesMap.get(uri.fsPath) || []
      if (linkedFiles.length === 0) {
        // uri를 소스로 하는 모든 issue에서 언급된 파일들을 모두 리턴한다.
        PrismManager.travelIssues(issue => {
          const path = vscode.Uri.file(PrismPath.getAbsolutePath(issue.source.file))
          if (path.fsPath === uri.fsPath) {
            issue.notes.forEach(note => {
              if (note.link) {
                linkedFiles.push(note.link)
              }
            })
          }
          return false
        })
        linkedFilesMap.set(uri.fsPath, linkedFiles)
      }

      // result에서 현재 소스 파일과 연관된 파일들을 찾아서 linkedDocs에 저장한다.
      const prismFolder = PrismPath.getPrismFolderPath()
      return await Promise.all(
        linkedFiles.map(async linked => {
          let uri = vscode.Uri.file(linked)
          if (linked.startsWith('file:///./')) {
            uri = vscode.Uri.file(prismFolder + linked.replace('file:///./', '/'))
          }

          return { uri, content: await PrismFileSystem.getDocContent(uri) }
        })
      )
    }

    // enable hover for all the relevant code files
    context.subscriptions.push(
      vscode.languages.registerHoverProvider(['*'], {
        async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken) {
          const mdsArray: vscode.MarkdownString[] = []
          const infos = await getLinkedDocInfo(document.uri)
          infos.forEach(doc => {
            const args = [doc.uri]
            const commandId = 'markdown.showPreviewToSide'
            const encodedArgs = encodeURIComponent(JSON.stringify(args))
            const openCommandUri = vscode.Uri.parse(`command:${commandId}?${encodedArgs}`)
            const mds = new vscode.MarkdownString(
              `[🔗 Open relative document (by Code Prism)](${openCommandUri}) <div>\n${doc.content}\n</div>`
            )
            mds.supportHtml = true
            mds.isTrusted = true
            mdsArray.push(mds)
          })

          if (mdsArray.length === 0) {
            return null
          }
          return new vscode.Hover(mdsArray)
        },
      })
    )

    context.subscriptions.push(
      vscode.commands.registerCommand('CodePrism.command.OpenRelativeDoc', async () => {
        const document = vscode.window.activeTextEditor?.document
        if (!document) {
          return
        }

        /**
         * Returns the URI with the longest length from an array of URIs.
         * The longer the path, the lower it is considered.
         *
         * @param uris - An array of URI strings.
         * @returns The URI with the longest length.
         */
        const getShortestUri = (uris: string[]): string => {
          return uris.reduce(function (a, b) {
            return a.length >= b.length ? a : b
          })
        }

        const infos = await getLinkedDocInfo(document.uri)
        if (infos.length <= 0) {
          vscode.window.showInformationMessage('🔒 No link detected.')
        } else {
          const shortestPath = getShortestUri(infos.map(e => e.uri.fsPath))
          vscode.commands.executeCommand('markdown.showPreviewToSide', vscode.Uri.file(shortestPath))
        }
      })
    )
  }
}
