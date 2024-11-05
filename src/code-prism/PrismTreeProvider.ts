import * as vscode from 'vscode'

import { Prism, Issue } from './Prism'
import { PrismManager, SubscribeType } from './PrismManager'

/**
 * Represents an prism item in the VS Code tree view.
 * This class extends the `vscode.TreeItem` class and adds a `prism` property
 *
 * @extends vscode.TreeItem
 */
export class PrismItem extends vscode.TreeItem {
  /**
   * Constructs a new instance of the PrismItem.
   *
   * @param prism - The Prism instance associated with this tree item.
   */
  constructor(public readonly prism: Prism) {
    super(prism.name, vscode.TreeItemCollapsibleState.Collapsed)
    this.tooltip = prism.name
    this.iconPath = new vscode.ThemeIcon('file-code')
    // contextValue는 'contributes/menus/view/item/context'에서 prismFile.delete, issue.delete 명령을 구분하기 위해서 사용한다.
    this.contextValue = 'PrismItem'
    // arguments로 [this]를 전달하는 이유는 [prismFile.show 명령 등록](./PrismCommands.ts#105-110)하는 부분을 참조한다.
    this.command = {
      command: 'CodePrism.command.prismFile.show',
      title: 'Open',
      arguments: [this],
    }
  }
}

/**
 * Represents a issue item in the VS Code tree view.
 * This class extends the `vscode.TreeItem` class and adds a `issue` property
 *
 * @extends vscode.TreeItem
 */
export class IssueItem extends vscode.TreeItem {
  /**
   * Constructs a new instance of the IssueItem.
   *
   * @param prism - The Prism instance associated with this tree item.
   * @param issue - The Issue instance containing details about the issue.
   * @param parent - The parent PrismItem instance.
   *
   * The label displayed is the first description context of the issue, not the issue's title.
   * The tooltip is set to the issue's title.
   * The icon is set to a comment icon.
   * The command executed is 'CodePrism.command.prismFile.show' with the current instance as an argument.
   */
  constructor(public readonly prism: Prism, public readonly issue: Issue, public readonly parent?: PrismItem) {
    // 표시되어질 label은 issue의 title이 아니라 issue의 첫번째 description context이다.
    let label: vscode.TreeItemLabel = { label: issue.title }
    if (issue.notes && issue.notes.length > 0) {
      label = {
        label: `${issue.notes[0].category} ▷ ${issue.notes[0].content}`,
        highlights: [[0, issue.notes[0].category.length]],
      }
    }
    // IssueItem은 자식을 가지지 않으므로 vscode.TreeItemCollapsibleState.None을 사용한다.
    super(label, vscode.TreeItemCollapsibleState.None)
    // tooltip은 issue의 title을 사용한다.
    const tooltip = new vscode.MarkdownString('$(code) ', true)
    tooltip.appendMarkdown(issue.title)
    this.tooltip = tooltip
    // icon은 commentController와 동일하게 하기 위해 comment icon을 사용한다.
    this.iconPath = new vscode.ThemeIcon('comment')
    // contextValue는 'contributes/menus/view/item/context'에서 prismFile.delete, issue.delete 명령을 구분하기 위해서 사용한다.
    this.contextValue = 'IssueItem'
    // PrismItem과 마찬가지 이유로 arguments로 [this]를 전달하는데 IssueItem은 issue의 값을 참조할 수 있어야 한다.
    this.command = {
      command: 'CodePrism.command.issue.goto',
      title: 'Open',
      arguments: [this],
    }
  }
}

/**
 * Represents an element in the tree structure, which can be either a `PrismItem` or a `IssueItem`.
 */
export type TreeElement = PrismItem | IssueItem

/**
 * Provides a data provider for the Prism tree view in Visual Studio Code.
 * Implements the `vscode.TreeDataProvider` interface to supply `PrismItem` elements
 * for the tree view. This class manages the list of Prism items, handles their
 * retrieval, addition, deletion, and refresh operations.
 *
 * @implements {vscode.TreeDataProvider<TreeElement>}
 */
export class PrismTreeProvider implements vscode.TreeDataProvider<TreeElement> {
  /**
   * An array of `PrismItem` objects.
   * This array is used to store items related to the Prism functionality.
   * It is initialized as an empty array.
   */
  private items: TreeElement[] = []

  private viewMode: string = 'tree'
  private sortByName: string = 'asc'
  private sortByCate: string = 'asc'
  private sortByTime: string = 'asc'

  /**
   * Event emitter that triggers when the tree data changes.
   * It emits an event with a `TreeElement` or `undefined` as the payload.
   *
   * @private
   * @type {vscode.EventEmitter<TreeElement | undefined>}
   */
  // prettier-ignore
  private _onDidChangeTreeData: vscode.EventEmitter<TreeElement | undefined> = 
    new vscode.EventEmitter<TreeElement | undefined>()

  /**
   * An event that is fired when the tree data changes.
   *
   * @readonly
   * @type {vscode.Event<TreeElement | undefined>}
   */
  readonly onDidChangeTreeData: vscode.Event<TreeElement | undefined> = this._onDidChangeTreeData.event

  /**
   * Retrieves the parent of the given tree element.
   *
   * @param element - The tree element for which to get the parent.
   * @returns The parent tree element if the given element is an instance of `IssueItem`, otherwise `undefined`.
   */
  getParent(element: TreeElement): vscode.ProviderResult<TreeElement> {
    if (element instanceof IssueItem) {
      return element.parent
    }
    return undefined
  }

  /**
   * Retrieves a TreeItem representation of the given PrismFile element.
   *
   * @param element - The PrismFile instance for which to retrieve the TreeItem.
   * @returns The TreeItem representation of the provided PrismFile element.
   */
  getTreeItem(element: TreeElement): vscode.TreeItem {
    return element
  }

  /**
   * Retrieves the child elements of a given `PrismFile` element.
   * If no element is provided, it returns the top-level layers.
   *
   * @param element - The `PrismFile` element for which to retrieve children. Optional.
   * @returns A promise that resolves to an array of `PrismFile` objects representing the child elements.
   */
  getChildren(element?: TreeElement): Thenable<TreeElement[]> {
    if (this.viewMode === 'tree') {
      if (element === undefined) {
        return Promise.resolve(this.items)
      } else {
        if (element instanceof PrismItem) {
          if (element.prism.issues === undefined) {
            return Promise.resolve([])
          }
          const issues = element.prism.issues.map(issue => new IssueItem(element.prism, issue, element))
          return Promise.resolve(issues)
        } else {
          return Promise.resolve([])
        }
      }
    } else {
      if (element === undefined) {
        return Promise.resolve(this.items)
      } else {
        return Promise.resolve([])
      }
    }
  }

  /**
   * Sorts the items based on the specified sort criteria.
   *
   * @param sort - The criteria to sort the items by. Can be 'name', 'cate', or 'time'.
   *
   * - 'name': Sorts the items by the name of the prism in ascending or descending order.
   * - 'cate': Sorts the items by the category of the first note in the issue in ascending or descending order.
   * - 'time': Sorts the items by the creation time of the first note in the issue in ascending or descending order.
   *
   * The sorting order (ascending or descending) is determined by the respective class properties:
   * - `this.sortByName` for 'name'
   * - `this.sortByCate` for 'cate'
   * - `this.sortByTime` for 'time'
   */
  private sortItems(sort: string) {
    switch (sort) {
      case 'name': {
        this.items = this.items.sort((a, b) => {
          if (this.sortByName === 'asc') {
            return a.prism.name.localeCompare(b.prism.name)
          } else {
            return b.prism.name.localeCompare(a.prism.name)
          }
        })
        break
      }
      case 'cate': {
        this.items = this.items.sort((a, b) => {
          if (a instanceof PrismItem || b instanceof PrismItem) {
            return 0
          }

          const ac = a.issue.notes[0].category
          const bc = b.issue.notes[0].category
          if (this.sortByCate === 'asc') {
            return ac.localeCompare(bc)
          } else {
            return bc.localeCompare(ac)
          }
        })
        break
      }
      case 'time': {
        this.items = this.items.sort((a, b) => {
          if (a instanceof PrismItem || b instanceof PrismItem) {
            return 0
          }

          const ac = a.issue.notes[0].createdAt
          const bc = b.issue.notes[0].createdAt
          if (this.sortByTime === 'asc') {
            return ac.localeCompare(bc)
          } else {
            return bc.localeCompare(ac)
          }
        })
        break
      }
    }
  }

  /**
   * Registers the PrismFileProvider with the VSCode window and subscribes to various PrismManager events.
   *
   * The following events are subscribed to:
   * - `create-prism`: Appends a new prism to the provider.
   * - `delete-prism`: Deletes an existing prism from the provider.
   * - `append-issue`: Appends a issue to an existing prism.
   * - `remove-issue`: Removes a issue from an existing prism.
   */
  register() {
    // vscode.window.registerTreeDataProvider('CodePrism.view.prismView', this)
    // context.subscriptions.push(this)

    // this.onDidChangeTreeData(e => {
    //   console.log('onDidChangeTreeData', e)
    // })

    PrismManager.subscribe('create-prism', (data: SubscribeType) => {
      if (data.prism) {
        this.appendPrismItem(data.prism)
      }
    })

    PrismManager.subscribe('delete-prism', (data: SubscribeType) => {
      if (data.prism) {
        this.deletePrismItem(data.prism)
      }
    })

    PrismManager.subscribe('append-issue', (data: SubscribeType) => {
      this.refreshPrismView()

      // this.refreshPrismView()만으로는 refresh가 되지 않는 경우가 있다.
      if (this.viewMode === 'tree') {
        const debug = this.items.find(item => item.prism === data.prism)
        if (!debug) {
          console.warn('append-issue: item.prism !== data.prism')
          this.items = []
          const prisms = PrismManager.getAllPrisms()
          prisms.forEach(p => {
            this.appendPrismItem(p)
          })
          this.refreshPrismView()
        }
      } else {
        const debug = this.items.find(
          item => item.prism === data.prism && item instanceof IssueItem && item.issue === data.issue
        )
        if (!debug) {
          console.warn('append-issue: item.prism !== data.prism || item.issue !== data.issue')
          this.items = []
          const prisms = PrismManager.getAllPrisms()
          prisms.forEach(p => {
            p.getIssues().forEach(issue => {
              this.appendIssueItem(p, issue)
            })
          })
          this.refreshPrismView()
        }
      }
    })

    PrismManager.subscribe('remove-issue', (data: SubscribeType) => {
      this.refreshPrismView()

      // this.refreshPrismView()만으로는 refresh가 되지 않는 경우가 있다.
      // items 배열의 PrismItem에 prism이 이미 변경되어진 이후에 이것이 호출되므로 this.refreshPrismView()만으로
      // refresh가 될 수 있을 것 같은데 그렇지 않았다. cache되어진 것을 사용하지는 정확히는 모르겠지만 변경된 것과
      // item이 가지고 있는 prism이 다른 경우가 있다.
      if (this.viewMode === 'tree') {
        const debug = this.items.find(item => item.prism === data.prism)
        if (!debug) {
          console.warn('remove-issue: item.prism !== data.prism')
          this.items = []
          const prisms = PrismManager.getAllPrisms()
          prisms.forEach(p => {
            this.appendPrismItem(p)
          })
          this.refreshPrismView()
        }
      } else {
        // this.items 자체가 IssueItem이기 때문에 tree인 경우와는 다르게 item 내부의 변화가 없다.
        // 따라서 this.refreshPrismView()로 전혀 갱신되지 않는다. 직접 삭제해 주어야 한다.
        const debug = this.items.find(
          item => item.prism === data.prism && item instanceof IssueItem && item.issue === data.issue
        )
        console.log('remove-issue', debug)
        if (!debug) {
          console.warn('remove-issue: item.prism !== data.prism || item.issue !== data.issue')
          this.items = []
          const prisms = PrismManager.getAllPrisms()
          prisms.forEach(p => {
            p.getIssues().forEach(issue => {
              this.appendIssueItem(p, issue)
            })
          })
        } else {
          this.items = this.items.filter(
            item => !(item instanceof IssueItem && item.prism === data.prism && item.issue === data.issue)
          )
        }
        this.refreshPrismView()
      }
    })

    PrismManager.subscribe('update-note', (data: SubscribeType) => {
      this.refreshPrismView()
    })

    PrismManager.subscribe('remove-note', (data: SubscribeType) => {
      this.refreshPrismView()
    })
  }

  /**
   * Refreshes the current items by clearing the existing list and reloading
   * prism files if the prism folder exists. After loading the prism files,
   * it appends each prism to the items list and refreshes the prism view.
   */
  async reload(prisms?: Prism[]) {
    this.items = []
    if (!prisms) {
      prisms = await PrismManager.loadPrismFiles()
    }
    prisms.forEach(p => {
      this.appendPrismItem(p)
    })
    this.refreshPrismView()
  }

  /**
   * Refreshes the Prism view based on the provided mode and sort order.
   *
   * @param view - The view mode to set. If different from the current view mode, the view mode is updated and the items are reloaded.
   *               - 'tree': Displays the prisms in a tree structure.
   *               - 'list': Displays the issues of each prism in a list.
   * @param sort - The sort order to apply to the items.
   *
   * This method updates the view mode and reloads the items accordingly. If the mode is 'tree', it appends each prism item.
   * If the mode is 'list', it appends each issue item of the prisms. It also updates the sort mode and refreshes the Prism view.
   * Additionally, it sets the context for the prism view mode in VS Code.
   */
  async refresh(view: string, sort: string) {
    if (view && view !== this.viewMode) {
      this.viewMode = view
      this.items = []
      const prisms = await PrismManager.loadPrismFiles()
      if (view === 'tree') {
        prisms.forEach(p => {
          this.appendPrismItem(p)
        })
      } else {
        prisms.forEach(p => {
          p.getIssues().forEach(issue => {
            this.appendIssueItem(p, issue)
          })
        })
      }

      vscode.commands.executeCommand('setContext', 'CodePrism.context.prismView.isList', view === 'list')
    }

    if (sort) {
      this.sortItems(sort)
      switch (sort) {
        case 'name':
          this.sortByName = this.sortByName === 'asc' ? 'desc' : 'asc'
          break
        case 'cate':
          this.sortByCate = this.sortByCate === 'asc' ? 'desc' : 'asc'
          break
        case 'time':
          this.sortByTime = this.sortByTime === 'asc' ? 'desc' : 'asc'
          break
      }
    }

    this.refreshPrismView()
  }

  /**
   * Refreshes the Prism view by firing the `_onDidChangeTreeData` event.
   * This method triggers an update to the tree data, causing the view to refresh.
   */
  refreshPrismView(data?: TreeElement) {
    this._onDidChangeTreeData.fire(data)
  }

  /**
   * Appends a new PrismItem to the items array.
   *
   * @param prism - The Prism object to be converted into a PrismItem and appended.
   */
  appendPrismItem(prism: Prism) {
    this.items.push(new PrismItem(prism))
    this.refreshPrismView()
  }

  /**
   * Deletes an item from the items array based on the provided label.
   *
   * @param name - The label of the item to be deleted.
   */
  deletePrismItem(prism: Prism) {
    this.items = this.items.filter(item => item.label !== prism.name)
    this.refreshPrismView()
  }

  /**
   * Appends a new issue item to the list of items and refreshes the prism view.
   *
   * @param prism - The prism object to which the issue is related.
   * @param issue - The issue object to be appended.
   */
  appendIssueItem(prism: Prism, issue: Issue) {
    this.items.push(new IssueItem(prism, issue))
    this.refreshPrismView()
  }
}
