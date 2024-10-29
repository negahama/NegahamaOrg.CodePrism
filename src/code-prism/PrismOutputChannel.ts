import * as vscode from 'vscode'

/**
 * Pads the current string or number with another string (multiple times, if needed) until the resulting string reaches the given length.
 * The padding is applied from the start (left) of the current string.
 *
 * @param v - The string or number to pad.
 * @param len - The target length of the resulting string once the current string has been padded.
 * @param filler - The string to pad the current string with. Defaults to a space if not provided.
 * @returns The padded string.
 */
export function padStart(v: number | string, len: number, filler?: string) {
  return (v + '').padStart(len, filler)
}

/**
 * Converts a given date input into a formatted string in the format 'YYYY-MM-DD'.
 *
 * @param d - The date input which can be a Date object, a number (timestamp), or a string.
 * @returns A string representing the date in 'YYYY-MM-DD' format.
 */
export function getDateStr(d: Date | number | string) {
  if (typeof d === 'number' || typeof d === 'string') {
    d = new Date(d)
  }
  return `${d.getFullYear()}-${padStart(d.getMonth() + 1, 2, '0')}-${padStart(d.getDate(), 2, '0')}`
}

/**
 * Converts a given date, number, or string into a formatted date-time string.
 *
 * @param d - The date input which can be a Date object, a timestamp number, or a date string.
 * @returns A string representing the formatted date and time in the format `YYYY-MM-DD HH:mm:ss.SSS`.
 */
export function getDateTimeStr(d: Date | number | string) {
  if (typeof d === 'number' || typeof d === 'string') {
    d = new Date(d)
  }
  return (
    `${d.getFullYear()}-${padStart(d.getMonth() + 1, 2, '0')}-${padStart(d.getDate(), 2, '0')} ` +
    `${padStart(d.getHours(), 2, '0')}:${padStart(d.getMinutes(), 2, '0')}:` +
    `${padStart(d.getSeconds(), 2, '0')}.${padStart(d.getMilliseconds(), 3, '0')}`
  )
}

/**
 * The `PrismOutputChannel` class provides a wrapper around the VS Code output channel.
 * It facilitates logging messages with timestamps, disposing of the channel, and activating
 * the extension by registering relevant commands.
 *
 * @remarks
 * This class is specifically designed to work within the VS Code extension environment.
 *
 * @example
 * ```typescript
 * const prismOutputChannel = new PrismOutputChannel();
 * prismOutputChannel.log('This is a log message.');
 * prismOutputChannel.activate(context);
 * ```
 */
class PrismOutputChannel {
  /**
   * A readonly reference to the VS Code output channel.
   * This channel is used to output log messages, errors, and other information.
   */
  private readonly channel: vscode.OutputChannel

  /**
   * Constructs a new instance of the PrismOutputChannel class.
   * Initializes the output channel with the name 'Code Prism'.
   */
  constructor() {
    this.channel = vscode.window.createOutputChannel('Code Prism')
  }

  /**
   * Disposes of the current channel.
   *
   * This method releases any resources held by the channel and performs necessary cleanup.
   * It should be called when the channel is no longer needed to free up resources.
   */
  dispose() {
    this.channel.dispose()
  }

  /**
   * Logs a message to the output channel with a timestamp.
   *
   * @param message - The message to log.
   * @returns The formatted log string with the timestamp.
   */
  log(message: string) {
    const str = `${getDateTimeStr(new Date())} ${message}`
    this.channel.appendLine(str)
    return str
  }

  /**
   * Activates the extension by registering the 'CodePrism.command.showOutput' command.
   * When the command is executed, it shows the output channel without taking focus.
   *
   * @param context - The context in which the extension is activated.
   */
  activate(context: vscode.ExtensionContext) {
    vscode.commands.registerCommand('CodePrism.command.showOutput', async () => {
      this.channel.show(false)
    })
  }
}

export const output = new PrismOutputChannel()
