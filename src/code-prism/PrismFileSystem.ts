import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'

import { PrismPath } from './PrismPath'
import { Issue, Prism } from './Prism'

/**
 * The `PrismFileManager` class provides methods to manage Prism files within a Visual Studio Code workspace.
 * It includes functionalities to retrieve workspace paths, check for the existence of folders and files,
 * create new files and folders, and perform file operations such as renaming and deleting.
 *
 * @remarks
 * This class relies on the Visual Studio Code API and Node.js file system operations to manage files and directories.
 * It is designed to work within the context of a Visual Studio Code extension.
 */
export class PrismFileSystem {
  /**
   * Checks if the Prism folder exists.
   *
   * @returns {boolean} `true` if the Prism folder exists, otherwise `false`.
   */
  static isPrismFolderExists(): boolean {
    return fs.existsSync(PrismPath.getPrismFolderPath())
  }

  /**
   * Checks if a prism file with the given name exists.
   *
   * @param name - The name of the prism file to check.
   * @returns `true` if the prism file exists, otherwise `false`.
   */
  static isPrismFileExists(name: string): boolean {
    return fs.existsSync(PrismPath.getPrismFilePath(name))
  }

  /**
   * Retrieves the names of all prism files in the prism folder.
   *
   * This method first checks if the prism folder exists. If it does not exist,
   * it returns an empty array. If the folder exists, it searches for all files
   * with the `PRISM_FILE_EXT` extension within the folder and returns their paths.
   *
   * @returns {Promise<string[]>} A promise that resolves to an array of file paths
   * of the prism files.
   */
  static async getPrismFileNames(): Promise<string[]> {
    if (!this.isPrismFolderExists()) {
      return []
    }

    // const prismFolderPath = this.getPrismFolderPath()
    // // const result: string[] = []
    // // fs.readdirSync(prismFolderPath).forEach(file => {
    // //   const filePath = path.resolve(prismFolderPath, file)
    // //   const stats = fs.statSync(filePath)
    // //   if (stats.isFile()) {
    // //     result.push(filePath)
    // //   }
    // // })
    // return fs.readdirSync(prismFolderPath).filter(name => name.endsWith(PRISM_FILE_EXT))

    let folderName = PrismPath.getPrismFolderName()
    let files = await vscode.workspace.findFiles(`**/${folderName}/*.${PrismPath.PRISM_FILE_EXT}`, null, 500)
    return files.map(file => file.fsPath)
  }

  /**
   * Creates a new Prism file and saves it.
   *
   * @param prism - The Prism object containing the data to be saved in the file.
   *
   * @remarks
   * This method is responsible for creating a new file for the given Prism object.
   * The actual file creation logic is currently commented out, and the method
   * directly calls `savePrismFile` to save the Prism data.
   */
  static async createPrismFile(prism: Prism): Promise<boolean> {
    // const workspaceEdit = new vscode.WorkspaceEdit();
    // workspaceEdit.createFile(vscode.Uri.file(this.getPrismFilePath(fileName)), {overwrite: false});
    // workspaceEdit.createFile(vscode.Uri.file(prismDocFilePath), {overwrite: false});
    // await vscode.workspace.applyEdit(workspaceEdit);

    this.savePrismFile(prism)
    return true
  }

  /**
   * Deletes a Prism file from the workspace.
   *
   * This method removes the specified file from the workspace using a `vscode.WorkspaceEdit`.
   * It does not perform any additional checks or operations on the file system.
   *
   * @param name - The name of the file to be deleted.
   * @returns A promise that resolves when the file has been deleted.
   */
  static async deletePrismFile(fileName: string): Promise<boolean> {
    // if (this.isPrismFileExists(fileName)) {
    //   fs.unlinkSync(this.getPrismFilePath(fileName))
    // }
    // const files = fs.readdirSync(this.getPrismFolderPath())
    // if (files.length === 0) {
    //   fs.rmdirSync(this.getPrismFolderPath())
    // }

    const filePath = PrismPath.getPrismFilePath(fileName)
    const workspaceEdit = new vscode.WorkspaceEdit()
    workspaceEdit.deleteFile(vscode.Uri.file(filePath))
    await vscode.workspace.applyEdit(workspaceEdit)
    return true
  }

  /**
   * Saves the given Prism object to a file.
   *
   * @param prism - The Prism object to be saved.
   * @remarks
   * This method writes the Prism object to a file using the file system's synchronous write method.
   * The file path is determined by the prism's name.
   */
  static async savePrismFile(prism: Prism): Promise<boolean> {
    const prismFolderPath = PrismPath.getPrismFolderPath()
    if (!fs.existsSync(prismFolderPath)) {
      fs.mkdirSync(prismFolderPath)
    }

    fs.writeFileSync(PrismPath.getPrismFilePath(prism.name), prism.toString())
    return true
  }

  /**
   * Creates a markdown file with the given name, associated with a specific Prism and Issue.
   *
   * The method ensures that the necessary directories exist, and if the markdown file already exists, it returns `false`.
   * If the file does not exist, it creates the file with a template content that includes a title, a description, and a link to the source code.
   *
   * @param name - The name of the markdown file to be created (without the .md extension).
   * @param prism - The Prism object associated with the markdown file.
   * @param issue - The Issue object that provides source information for the markdown file.
   * @returns A promise that resolves to `true` if the file was created successfully, or `false` if the file already exists.
   */
  static async createMarkdownFile(name: string, prism: Prism, issue: Issue): Promise<boolean> {
    const prismFolderPath = PrismPath.getPrismFolderPath()
    if (!fs.existsSync(prismFolderPath)) {
      fs.mkdirSync(prismFolderPath)
    }

    const PRISM_DOCS_FOLDER_NAME = 'docs'
    const prismDocsFolderPath = path.join(PrismPath.getPrismFolderPath(), PRISM_DOCS_FOLDER_NAME)
    if (!fs.existsSync(prismDocsFolderPath)) {
      fs.mkdirSync(prismDocsFolderPath)
    }

    const markdownFilePath = path.resolve(prismDocsFolderPath, name + '.md')
    if (fs.existsSync(markdownFilePath)) {
      return false
    }

    // markdown link는 절대경로, 상대경로, 프로젝트 루트 경로등을 모두 지원한다.
    // 하지만 마크다운이 랜더링되어졌을 때와 랜더링되기 전의 텍스트 상태일때를 모두 지원해야 한다.
    // 랜더링 후의 링크는 마크다운이 처리하지만 이전의 링크는 PrismLinkProvider에서 처리한다.
    // 소스 파일의 경로는 workspace root 기준 경로이고 마크다운의 특성상 workspace 경로는 '/'가 필요한데
    // 이미 그렇게 되어져 있기 때문에 그냥 사용하면 된다.

    // 이 markdown 자체가 note와 관련이 있기 때문에 markdown title을 note의 content로 한다.
    let title = 'untitled'
    issue.notes.forEach(note => {
      if (note.content) {
        title = note.content
      }
    })
    let source = ''
    if (issue) {
      source = issue.source.file + '#' + issue.source.startLine + '-#' + issue.source.endLine
    }

    const content =
      `# ${title}\n` +
      `> This markdown file is for '${prism.name}'.\n>\n` +
      `> [code](${source}): ${PrismPath.getWorkspacePath()}${source}\n>\n` +
      `> You can edit this file to add more information about '${title}'.\n---\n`

    fs.writeFileSync(markdownFilePath, content)
    return true
  }

  /**
   * Creates a new file with the specified contents in the Prism documentation folder.
   * If the file already exists, the function returns false.
   *
   * @param fileName - The name of the file to be created.
   * @param contents - The contents to be written to the file.
   * @returns A promise that resolves to a boolean indicating whether the file was successfully created.
   */
  static createFile(fileName: string, contents: string): boolean {
    if (fs.existsSync(fileName)) {
      return false
    }

    const dirPath = path.dirname(fileName)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    try {
      fs.writeFileSync(fileName, contents)
      return true
    } catch (err) {
      console.error(err)
    }
    return false
  }

  /**
   * Reads the content of a file synchronously.
   *
   * @param fileName - The path to the file to be read.
   * @returns The content of the file as a string. If the file does not exist, returns an empty string.
   */
  static readFile(fileName: string): string {
    // const fileExtRegex = /(?:\.([^.]+))?$/
    // const fileExtension = fileExtRegex.exec(fileName)![1]
    // const rawData = await vscode.workspace.fs.readFile(vscode.Uri.file(fileName))
    // const fileContent = rawData.toString()

    if (fs.existsSync(fileName)) {
      return fs.readFileSync(fileName, 'utf8')
    }
    return ''
  }

  /**
   * Saves the provided contents to a file with the specified file name.
   * If the directory path does not exist, it will be created recursively.
   *
   * @param fileName - The name (and path) of the file to save.
   * @param contents - The contents to write to the file.
   * @returns `true` if the file was saved successfully, otherwise `false`.
   */
  static saveFile(fileName: string, contents: string): boolean {
    const dirPath = path.dirname(fileName)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }

    try {
      fs.writeFileSync(fileName, contents)
      return true
    } catch (err) {
      console.error(err)
    }
    return false
  }

  /**
   * Retrieves the content of a document file with optional line limit and fragment.
   * 링크된 uri에 fragment가 포함되어 있으면 오픈할 파일명으로 적절하지 않기 때문에 이를 제거하는데 이미 그렇게 오고 있다.
   * markdown 문서가 아니면 코드로 표시한다.
   *
   * @param fileName - The name of the file to read.
   * @param lineLimit - The maximum number of lines to read from the file. Defaults to 10. Use -1 for no limit.
   * @param fragment - An optional fragment to include in the content.
   * @returns The content of the file as a string, formatted with code blocks if necessary.
   *
   * @remarks
   * - If the file is not a markdown file and the line limit is not -1, the content will be truncated to the specified number of lines.
   * - If the file is a markdown file and the line limit is -1, the function ensures that code blocks are properly closed.
   * - If the content is truncated, a `... <more>` indicator is appended to the content.
   * - In case of an error while reading the file, the function returns `# No content` and logs the error to the console.
   */
  static async getDocContent(fileName: string | vscode.Uri, lineLimit: number = 10): Promise<string> {
    const fsPath = fileName instanceof vscode.Uri ? fileName.fsPath : fileName
    const fragment = fileName instanceof vscode.Uri ? fileName.fragment : ''
    const ext = path.extname(fsPath)

    let content: string = '# No content'
    try {
      await vscode.workspace.openTextDocument(vscode.Uri.file(fsPath)).then(document => {
        content = document.getText()
      })
    } catch (err) {
      console.error(err)
      return content
    }

    const lines = content.split('\n')

    let startLine = 0
    let endLine = lines.length

    if (fragment) {
      const match = fragment.match(/(?:#L)?(\d+)-(?:L)?(\d+)/)
      if (match) {
        startLine = parseInt(match[1]) - 1
        endLine = parseInt(match[2])
      }
      startLine = Math.max(0, startLine)
      endLine = Math.min(endLine, lines.length)
      if (startLine > endLine) {
        return '# No content'
      }
    }

    let isMore = false
    if (lineLimit !== -1) {
      if (endLine - startLine > lineLimit) {
        endLine = startLine + lineLimit
        isMore = true
      }
    }

    let selectedLines = lines.slice(startLine, endLine)

    // 모든 라인이 지나치게 indent되어져 있을 수 있으므로 이를 조정한다.
    let minIndent = Number.MAX_SAFE_INTEGER
    selectedLines.forEach(line => {
      const indent = line.search(/\S/)
      if (indent >= 0) {
        minIndent = Math.min(minIndent, indent)
      }
    })
    selectedLines = selectedLines.map(line => line.substring(minIndent))

    if (ext !== '.md') {
      // markdown이 아닌 경우에는 코드로 표시하며 lineLimit와 fragment를 적용한다.
      content = '\n```\n' + selectedLines.join('\n') + '\n```\n'
    } else {
      // markdown인 경우에는 일부분만 표시하는 경우(전체 표시인 경우에도 이 로직으로 처리)
      // 깔끔하게 표시하기 위해서 ``` 의 쌍을 맞춰야 한다.
      // 먼저 표시 영역 윗부분에 ```이 닫혔는지 확인한다.
      let backtickOpen = false
      let backtickCount = lines.filter((line, idx) => idx < startLine && line.includes('```')).length
      if (backtickCount % 2 === 1) {
        backtickOpen = true
        selectedLines.unshift('```\n')
      }
      // 표시 영역 내부에서 ```이 닫혔는지 확인한다.
      backtickCount = lines.filter((line, idx) => idx >= startLine && idx < endLine && line.includes('```')).length
      backtickCount += backtickOpen ? 1 : 0
      if (backtickCount % 2 === 1) {
        selectedLines.push('\n```')
      }
      content = selectedLines.join('\n')
    }
    if (isMore) {
      content += '\n`... <more>`'
    }
    return content
  }
}
