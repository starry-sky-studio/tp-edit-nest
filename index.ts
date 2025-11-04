/**
 * 我想添加表格到fabirs画布中
 * 表格中的文本可以编辑
 * 定义表格的类型结构
 * 就像 PPT中的表格 功能一样
 */

import {
  Canvas,
  Group,
  Rect,
  Textbox,
  TEvent,
  util,
  classRegistry,
} from 'fabric';

// 表格单元格类型定义
export interface TableCell {
  text: string;
  options?: {
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    fontFace?: string;
    fontSize?: number;
    color?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fill?: string;
    border?: {
      type?: 'none' | 'solid' | 'dash';
      pt?: number;
      color?: string;
    };
    margin?: number | [number, number, number, number]; // TRBL
    colspan?: number;
    rowspan?: number;
  };
}

// 表格行类型定义
export type TableRow = TableCell[];

// 表格模式枚举
export type TableMode = '' | 'select' | 'edit';

// 表格选项类型定义
export interface TableOptions {
  // 位置和尺寸
  x?: number;
  y?: number;
  w?: number;
  h?: number;

  // 表格布局
  colW?: number | number[]; // 列宽
  rowH?: number | number[]; // 行高

  // 表格格式
  align?: 'left' | 'center' | 'right';
  fontFace?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fill?: string;
  border?: {
    type?: 'none' | 'solid' | 'dash';
    pt?: number;
    color?: string;
  };
  margin?: number | [number, number, number, number];

  // 表格样式
  headerRows?: number;
  autoPage?: boolean;
  autoPageRepeatHeader?: boolean;
  autoPageHeaderRows?: number;
}

// 表格类定义
export class FabricTable extends Group {
  public get type(): string {
    return 'FabricTable';
  }
  public tableData: TableRow[];
  public tableOptions: TableOptions;
  public cellObjects: Rect[][];
  public textObjects: Textbox[][];
  private mode: TableMode = ''; // 表格模式状态
  private currentEditingCell: { rowIndex: number; colIndex: number } | null =
    null;
  private boundsCacheValid: boolean = false; // 边界缓存是否有效

  constructor(
    tableData: TableRow[],
    options: TableOptions = {},
    canvas?: Canvas,
  ) {
    super([], {
      selectable: true,
      evented: true,
      left: options.x || 0,
      top: options.y || 0,
      // 保持 Group 的默认 originX/Y，但内部子对象需要调整
      originX: 'left',
      originY: 'top',
      subTargetCheck: true, // 允许命中检测子对象，确保点击 Textbox 能成为事件 target
      interactive: true, // 允许交互
      // 确保对象可以被选中并显示控制点
      excludeFromExport: false,
      objectCaching: false,
    });

    this.tableData = tableData;
    this.tableOptions = {
      x: 0,
      y: 0,
      w: 300, // 使用像素单位
      h: 200, // 使用像素单位
      colW: 100, // 使用像素单位
      rowH: 50, // 使用像素单位
      align: 'left',
      fontFace: 'Arial',
      fontSize: 12,
      color: '#000000',
      fill: '#ffffff',

      border: {
        type: 'solid',
        pt: 1,
        color: '#000000',
      },
      margin: 8,
      ...options,
    };

    this.cellObjects = [];
    this.textObjects = [];

    this.createTable();

    if (canvas) {
      console.log('添加表格到画布:', this);
      console.log('表格尺寸:', this.getBoundingRect());
      canvas.add(this);
      canvas.renderAll();
      console.log('画布对象数量:', canvas.getObjects().length);

      // 在 Group 级别添加事件监听器
      this.setupGroupEventListeners();

      // 监听画布点击事件：仅当点击表格外时，才退出编辑模式
      canvas.on('mouse:down', (opt: TEvent) => {
        if (this.mode !== 'edit') return;

        const currentTextbox =
          this.textObjects[this.currentEditingCell?.rowIndex || -1]?.[
            this.currentEditingCell?.colIndex || -1
          ];

        if (!(currentTextbox instanceof Textbox)) return;

        // 检查点击目标
        const target = (opt as any).target as any | undefined;

        // 如果点击的不是当前编辑的textbox，且textbox正在编辑，则退出编辑
        if (target !== currentTextbox && currentTextbox.isEditing) {
          // 检查是否点击在表格内的其他位置
          const clickedOnTable = this.getObjects().includes(target);

          if (!clickedOnTable) {
            // 点击在表格外，退出编辑
            currentTextbox.exitEditing();
            console.log('exitEditing - clicked outside table');
            this.currentEditingCell = null;
            this.mode = ''; // 退出编辑模式
          }
        }
      });

      // 监听表格选中和编辑模式切换
      canvas.on('mouse:down', (opt: TEvent) => {
        if (this.mode === 'edit') return; // 编辑模式下不干预
        const target = (opt as any).target as any | undefined;
        if (!target) return;

        if (this.getObjects().includes(target)) {
          this.mode = 'select';
          // 确保表格拖拽正常工作
          this.set('selectable', true);
          this.set('evented', true);

          canvas.setActiveObject(this);
          // 同步选择框高度，确保包含增高后的所有子元素
          this.syncSelectionBounds();
          canvas.requestRenderAll();
        } else {
          // 点击表格外部，退出所有状态并确保拖拽功能正常
          if (this.mode === 'select') {
            this.mode = '';
            // 保持表格的拖拽功能
            this.set('selectable', true);
            this.set('evented', true);

            // 如果正在编辑单元格，退出编辑
            if (this.currentEditingCell) {
              const currentTextbox =
                this.textObjects[this.currentEditingCell.rowIndex]?.[
                  this.currentEditingCell.colIndex
                ];
              if (currentTextbox?.isEditing) {
                currentTextbox.exitEditing();
              }
              this.currentEditingCell = null;
            }
          }
        }
      });

      // 保持默认选择行为，避免抢夺 Textbox 焦点
    }
  }

  /**
   * 创建表格
   */
  private createTable(): void {
    // 移除 Group 的所有子对象
    this.getObjects().forEach((obj) => {
      this.remove(obj);
    });
    this.cellObjects = [];
    this.textObjects = [];

    // 标记边界缓存失效
    this.boundsCacheValid = false;

    const { tableData, tableOptions } = this;
    const { w, colW, rowH, fontFace, fontSize, color, border, margin } =
      tableOptions;

    if (!tableData || tableData.length === 0) {
      return;
    }

    const rows = tableData.length;
    const cols = tableData[0].length;

    // 计算列宽 - 确保使用像素单位
    const columnWidths = Array.isArray(colW)
      ? colW
      : new Array(cols).fill(colW || w! / cols);

    // 修改：固定单元格高度，而不是根据总高度平均分配
    // 如果 rowH 是数组，使用数组中的值；否则使用固定的单元格高度
    const fixedCellHeight = Array.isArray(rowH) ? rowH[0] : rowH || 50; // 默认50px
    const rowHeights = Array.isArray(rowH)
      ? rowH
      : new Array(rows).fill(fixedCellHeight);

    let currentY = 0;

    // 暂存所有子对象，用于最后的中心化调整
    const tempObjects: any[] = [];

    // 创建每一行
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const row = tableData[rowIndex];
      const rowHeight = rowHeights[rowIndex] || rowHeights[0];
      let currentX = 0;

      this.cellObjects[rowIndex] = [];
      this.textObjects[rowIndex] = [];

      // 创建每一列
      for (let colIndex = 0; colIndex < cols; colIndex++) {
        const cell = row[colIndex];
        const cellWidth = columnWidths[colIndex] || columnWidths[0];

        // 创建单元格矩形
        const cellRect = new Rect({
          left: currentX,
          top: currentY,
          width: cellWidth,
          height: rowHeight,
          // fill: 'red',
          fill: cell.options?.fill || tableOptions.fill || '#ffffff',
          stroke: border?.color || '#000000',
          lockMovementX: true,
          lockMovementY: true,
          strokeWidth: border?.pt || 1,
          selectable: false, // 禁止单独选择
          evented: true, // 禁止单独事件响应
          moveCursor: 'default', // 设置为默认光标
          hoverCursor: 'default', // 悬停时也是默认光标
        });

        // 添加自定义属性用于识别单元格位置
        (cellRect as any).cellRowIndex = rowIndex;
        (cellRect as any).cellColIndex = colIndex;
        (cellRect as any).cellType = 'cellRect';

        // 合并 margin 配置
        const cellMargin = Array.isArray(cell.options?.margin)
          ? cell.options.margin[0]
          : cell.options?.margin !== undefined
            ? Number(cell.options.margin)
            : margin !== undefined
              ? Array.isArray(margin)
                ? margin[0]
                : Number(margin)
              : 2;

        const cellText = new Textbox(cell.text, {
          //设置背景颜色
          backgroundColor: 'pink',
          left: currentX + cellMargin,
          top: currentY + cellMargin,
          width: cellWidth - cellMargin * 2,
          // 修正：Textbox的height属性在fabric.js中通常由内容决定，这里设置为最大高度，以帮助垂直对齐计算，
          // 但 Textbox 在多行时仍会调整自己的实际高度。
          height: rowHeight - cellMargin * 2,
          fontFamily: cell.options?.fontFace || fontFace || 'Arial',
          fontSize: cell.options?.fontSize || fontSize || 12,
          fill: cell.options?.color || color || '#000000',
          textAlign: cell.options?.align || 'left',
          selectable: false, // 禁止单独选择，只能通过 Group 选择
          evented: true, // 禁止单独事件响应，通过 Group 处理
          editable: true,
          lockMovementX: true,
          lockMovementY: true,
          splitByGrapheme: true,
          hasControls: false, // 在Group中隐藏控件
          hasBorders: false, // 在Group中隐藏边框
          moveCursor: 'text', // 设置为默认光标
          hoverCursor: 'text', // 悬停时也是默认光标
        });

        // 移除所有 textbox 单击事件，让 Group 统一处理

        // 记录单元格位置信息供后续使用
        (cellText as any).cellRowIndex = rowIndex;
        (cellText as any).cellColIndex = colIndex;
        (cellText as any).cellType = 'cellText';

        // v6修复：确保textbox有正确的canvas引用
        if (this.canvas) {
          cellText.canvas = this.canvas;
        }

        // 监听文本高度变化，自动调整行高
        cellText.on('changed', () => {
          this.adjustRowHeight(rowIndex);
        });
        // 补充：编辑输入过程中（每次字符变动）也触发行高调整
        // 修正: fabric@5.x 类型定义中 "text:changed" 不是合法事件; 应使用 "changed" 或 "editing:entered"/"editing:exited"
        // 为保证文本内容输入时也调整高度，监听 "changed" 事件已足够，移除 "text:changed" 的监听

        // 修正类型: cellObjects 应存储 Rect，textObjects 应存储 Textbox，避免类型冲突
        this.cellObjects[rowIndex][colIndex] = cellRect as Rect;
        this.textObjects[rowIndex][colIndex] = cellText as Textbox;

        tempObjects.push(cellRect, cellText);

        currentX += cellWidth;
      }

      currentY += rowHeight;
    }

    // 计算并设置表格的总尺寸 (基于累加的行高和列宽)
    const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0);

    // 设置 Group 的尺寸
    this.set('width', totalWidth);
    this.set('height', totalHeight);

    // *** 关键修正步骤：中心化子对象坐标 ***
    // Fabric Group 的子对象 left/top 默认是相对于 Group 的中心点，
    // 而我们创建时是基于 Group 的左上角 (0, 0)。
    // 所以，需要将所有子对象的 left/top 减去 Group 宽度/高度的一半。
    const offsetX = totalWidth / 2;
    const offsetY = totalHeight / 2;

    tempObjects.forEach((obj) => {
      obj.set({
        left: (obj.left ?? 0) - offsetX,
        top: (obj.top ?? 0) - offsetY,
      });
      this.add(obj);
    });
    // **********************************

    // 在坐标转换完成后，设置文本的垂直对齐
    let currentYForAlign = 0;
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const rowHeight = rowHeights[rowIndex] || rowHeights[0];
      const cols = this.cellObjects[rowIndex].length;

      for (let colIndex = 0; colIndex < cols; colIndex++) {
        const cellText = this.textObjects[rowIndex][colIndex];
        const cell = tableData[rowIndex][colIndex];

        if (cellText) {
          // 获取单元格的 margin
          const cellMargin = Array.isArray(cell.options?.margin)
            ? cell.options.margin[0]
            : cell.options?.margin !== undefined
              ? Number(cell.options.margin)
              : margin !== undefined
                ? Array.isArray(margin)
                  ? margin[0]
                  : Number(margin)
                : 4;

          // 计算文本应该的位置（相对于 Group 中心）
          const cellTop = currentYForAlign - offsetY;
          const textHeight =
            cellText.height ||
            cellText.calcTextHeight() ||
            cellText.fontSize ||
            12;
          const valign = cell.options?.valign || 'top';

          let textTop = cellTop + cellMargin;

          switch (valign) {
            case 'top':
              textTop = cellTop + cellMargin;
              break;
            case 'middle':
              textTop = cellTop + (rowHeight - textHeight) / 2;
              break;
            case 'bottom':
              textTop = cellTop + rowHeight - textHeight - cellMargin;
              break;
          }

          cellText.set('top', textTop);
        }
      }

      currentYForAlign += rowHeight;
    }

    // 重新计算边界框，确保选择框正确
    this.syncSelectionBounds();
  }

  /**
   * 设置文本垂直对齐
   * 修正：移除未定义的 currentY 引用，简化计算逻辑。
   * 修正：解决 textHeightGuess/textHeightBottom 可能是 undefined 的 TypeScript 警告。
   */
  private setVerticalAlignment(
    text: Textbox,
    valign: string,
    rowHeight: number,
    margin: number,
  ): void {
    // text.top 是文本相对于 Group 左上角 (0,0) 的初始 top 位置，它已包含 cellTop + margin
    const initialTop = text.top ?? 0;

    // 单元格的顶部位置 (currentY) = initialTop - margin
    const cellTop = initialTop - margin;

    let newTop = initialTop;

    // 确保 textHeight 总是有一个数值。
    // 依次尝试：1. 文本对象的高度 (text.height)，2. 计算后的文本高度 (text.calcTextHeight())，
    // 3. 字体大小 (text.fontSize)，4. 最终回退值 12。
    const textHeight =
      text.height || text.calcTextHeight() || text.fontSize || 12;

    switch (valign) {
      case 'top':
        // 保持在 initialTop, 即 cellTop + margin
        break;
      case 'middle':
        // 目标顶部位置 = cellTop + (rowHeight - textHeight) / 2
        newTop = cellTop + (rowHeight - textHeight) / 2;
        break;
      case 'bottom':
        // 目标顶部位置 = cellTop + rowHeight - textHeight - margin
        newTop = cellTop + rowHeight - textHeight - margin;
        break;
    }

    // 如果位置发生变化，更新 top 属性
    if (newTop !== initialTop) {
      text.set('top', newTop);
    }

    // NOTE: 对于 Textbox 的精确垂直居中，通常需要在对象添加到画布并渲染后，
    // 通过监听 'changed' 事件或使用 AfterRender 钩子来重新计算 text.height。
    // 在 Group 构造函数中进行 this.set('top', ...) 只能实现一个**近似**对齐，
    // 因为 text.height 尚未完全确定。

    // 修正：不要将 height 设置为 undefined，保持原有的高度设置以确保文本显示
    // text.set('height', undefined)
  }

  /**
   * 更新单元格文本
   */
  public updateCellText(
    rowIndex: number,
    colIndex: number,
    text: string,
  ): void {
    if (this.textObjects[rowIndex] && this.textObjects[rowIndex][colIndex]) {
      this.textObjects[rowIndex][colIndex].set('text', text);
      this.tableData[rowIndex][colIndex].text = text;
      this.canvas?.renderAll();
    }
  }

  /**
   * 处理单元格点击事件，进入文本编辑模式
   */
  public handleCellClick(
    rowIndex: number,
    colIndex: number,
    event?: any,
  ): void {
    if (this.textObjects[rowIndex] && this.textObjects[rowIndex][colIndex]) {
      const textObject = this.textObjects[rowIndex][colIndex];

      // 如果点击的是当前正在编辑的单元格，不需要重新进入编辑模式
      if (
        this.currentEditingCell &&
        this.currentEditingCell.rowIndex === rowIndex &&
        this.currentEditingCell.colIndex === colIndex &&
        textObject.isEditing
      ) {
        console.log('Already editing, allowing cursor repositioning');
        return; // 让fabric.js处理光标定位
      }

      // 如果点击的不是当前正在编辑的单元格，先退出之前的编辑模式
      if (
        this.currentEditingCell &&
        (this.currentEditingCell.rowIndex !== rowIndex ||
          this.currentEditingCell.colIndex !== colIndex)
      ) {
        const previousTextObject =
          this.textObjects[this.currentEditingCell.rowIndex]?.[
            this.currentEditingCell.colIndex
          ];
        if (previousTextObject && previousTextObject instanceof Textbox) {
          // 退出编辑模式
          previousTextObject.exitEditing();
        }
      }

      // 选中文本对象
      if (this.canvas) {
        // 如果是 Textbox，进入编辑模式
        if (textObject instanceof Textbox && !textObject.isEditing) {
          // 临时启用 textbox 的选择和事件响应
          textObject.set({
            selectable: true,
            evented: true,
            hoverCursor: 'text',
          });

          // v6修复：确保textbox有正确的canvas引用
          textObject.canvas = this.canvas;

          // 简化方案：直接在Group内编辑，不移动textbox位置
          this.canvas.setActiveObject(textObject);

          // 如果有点击事件，先设置光标位置再进入编辑模式
          if (event && event.e) {
            try {
              // 获取点击位置相对于textbox的索引
              const cursorIndex = textObject.getSelectionStartFromPointer(
                event.e,
              );
              if (typeof cursorIndex === 'number' && cursorIndex >= 0) {
                // 在进入编辑模式之前设置光标位置
                textObject.selectionStart = textObject.selectionEnd =
                  cursorIndex;
                console.log('预设光标位置到:', cursorIndex);
              }
            } catch (err) {
              console.warn('预设光标位置失败:', err);
            }
          }

          // 进入编辑模式
          textObject.enterEditing();
          this.canvas.requestRenderAll();

          // 确保焦点
          setTimeout(() => {
            const hiddenTextarea = (textObject as any).hiddenTextarea;
            if (hiddenTextarea) {
              hiddenTextarea.focus();
            }
          }, 10);

          // 记录当前正在编辑的单元格
          this.currentEditingCell = { rowIndex, colIndex };

          // 添加实时文本变化监听，用于动态调整行高
          const onTextChanging = () => {
            // 延迟执行，确保文本已经更新
            setTimeout(() => {
              this.adjustRowHeightDuringEdit(rowIndex, colIndex);
            }, 10);
          };

          const onTextChanged = () => {
            this.adjustRowHeightDuringEdit(rowIndex, colIndex);
          };

          // 监听文本编辑过程中的变化 - 在v6中使用 changed 事件
          textObject.on('changed', onTextChanged);
          // 可以添加其他事件监听来实现实时调整
          textObject.on('editing:entered', onTextChanging);

          // 监听文本编辑结束事件
          const onEditingExit = () => {
            textObject.off('editing:exited', onEditingExit);
            textObject.off('changed', onTextChanged);
            textObject.off('editing:entered', onTextChanging);

            // 编辑结束后重新禁用 textbox 的单独选择

            this.currentEditingCell = null;
            this.mode = 'select'; // 退出具体单元格编辑，返回表格选择模式

            // 确保表格拖拽功能正常
            this.set('selectable', true);
            this.set('evented', true);

            // 退出编辑后重新渲染和选中表格
            if (this.canvas) {
              this.canvas.setActiveObject(this);
              this.canvas.renderAll();
            }
          };

          textObject.on('editing:exited', onEditingExit);

          // 进入编辑模式时，保持表格可拖拽
          this.set('selectable', true);
          this.set('evented', true);
        }

        this.canvas.renderAll();
      }
    }
  }

  /**
   * 编辑期间调整行高，��保选中状态和对齐关系
   */
  private adjustRowHeightDuringEdit(rowIndex: number, colIndex: number): void {
    if (!this.textObjects[rowIndex] || !this.textObjects[rowIndex][colIndex]) {
      return;
    }

    const currentTextbox = this.textObjects[rowIndex][colIndex];
    const margin = this.tableOptions.margin;
    const cellMargin = Array.isArray(margin)
      ? margin[0]
      : margin !== undefined
        ? Number(margin)
        : 4;

    // 强制重新计算文本高度
    currentTextbox.set('dirty', true);
    const textHeight =
      currentTextbox.calcTextHeight() || currentTextbox.height || 0;

    console.log(`=== adjustRowHeightDuringEdit ===`);
    console.log(`编辑单元格[${rowIndex},${colIndex}]`);
    console.log(`textHeight: ${textHeight}`);

    if (textHeight === 0) {
      return;
    }

    // 计算需要的最小单元格高度
    const requiredCellHeight = Math.ceil(textHeight + cellMargin * 2 + 5);
    const currentCellHeight =
      this.cellObjects[rowIndex]?.[colIndex]?.height || 0;

    console.log(`requiredCellHeight: ${requiredCellHeight}`);
    console.log(`currentCellHeight: ${currentCellHeight}`);

    // 如果需要增加高度
    if (requiredCellHeight > currentCellHeight) {
      const newRowHeight = requiredCellHeight;
      const heightDelta = newRowHeight - currentCellHeight;

      console.log(`需要增加高度! heightDelta: ${heightDelta}`);

      // 标记边界缓存失效
      this.boundsCacheValid = false;
      // 增量式更新当前行、后续行以及总高度
      this.applyRowHeightDelta(rowIndex, newRowHeight);
    } else {
      console.log(`不需要增加高度`);
    }
  }

  /**
   * 重新定位所有行和文本，保持垂直对齐关系
   */
  private repositionAllRowsAndTexts(): void {
    const rowHeights = Array.isArray(this.tableOptions.rowH)
      ? this.tableOptions.rowH
      : new Array(this.tableData.length).fill(this.tableOptions.rowH || 50);
    const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0);
    const offsetY = totalHeight / 2;

    console.log('=== 重新定位所有行 ===');
    console.log('rowHeights:', rowHeights);
    console.log('totalHeight:', totalHeight);
    console.log('offsetY:', offsetY);

    let currentY = 0;

    // 重新定位所有行
    for (let rowIndex = 0; rowIndex < this.tableData.length; rowIndex++) {
      const rowHeight = rowHeights[rowIndex];
      const cols = this.cellObjects[rowIndex].length;

      console.log(
        `处理第${rowIndex}行, currentY: ${currentY}, rowHeight: ${rowHeight}`,
      );

      for (let colIndex = 0; colIndex < cols; colIndex++) {
        const cellRect = this.cellObjects[rowIndex][colIndex];
        const cellText = this.textObjects[rowIndex][colIndex];
        const cell = this.tableData[rowIndex][colIndex];

        if (cellRect) {
          // 计算相对于 Group 中心的位置
          const relativeTop = currentY - offsetY;
          console.log(
            `  单元格[${rowIndex},${colIndex}] relativeTop: ${relativeTop}`,
          );
          cellRect.set({ top: relativeTop, height: rowHeight });
          cellRect.setCoords();
        }

        if (cellText && cellRect) {
          // 重新计算文本位置，保持垂直对齐关系
          const margin = this.tableOptions.margin;
          const cellMargin = Array.isArray(cell.options?.margin)
            ? cell.options.margin[0]
            : cell.options?.margin !== undefined
              ? Number(cell.options.margin)
              : margin !== undefined
                ? Array.isArray(margin)
                  ? margin[0]
                  : Number(margin)
                : 4;

          const cellRectTop = currentY - offsetY;
          const textHeight =
            cellText.height ||
            cellText.calcTextHeight() ||
            cellText.fontSize ||
            12;
          let textTop = cellRectTop + cellMargin;

          // 保持原有的垂直对齐关系
          switch (cell.options?.valign || 'top') {
            case 'top':
              textTop = cellRectTop + cellMargin;
              break;
            case 'middle':
              textTop = cellRectTop + (rowHeight - textHeight) / 2;
              break;
            case 'bottom':
              textTop = cellRectTop + rowHeight - textHeight - cellMargin;
              break;
          }

          console.log(`  文本[${rowIndex},${colIndex}] textTop: ${textTop}`);
          cellText.set('top', textTop);
        }
      }

      // 关键：在处理完当前行后，累加当前行高度到下一行的起始位置
      currentY += rowHeight;
      console.log(
        `第${rowIndex}行处理完毕, 下一行起始位置 currentY: ${currentY}`,
      );
    }

    console.log('最终表格总高度:', totalHeight);
    // 修复：确保表格的整体高度也被更新
    this.set('height', totalHeight);
    this.setCoords();
  }

  /**
   * 仅当某一行增高时，做增量式调整：
   * 1) 计算 heightDelta；
   * 2) 更新该行所有单元格高度与文本垂直对齐；
   * 3) 将其后所有行整体向下平移 heightDelta；
   * 4) 表格总高度 += heightDelta；
   */
  private applyRowHeightDelta(rowIndex: number, newRowHeight: number): void {
    const oldRowHeight = this.cellObjects[rowIndex]?.[0]?.height || 0;
    const heightDelta = newRowHeight - oldRowHeight;
    if (heightDelta <= 0) return;

    const rowsCount = this.tableData.length;
    const margin = this.tableOptions.margin;

    // 2) 更新当前行：矩形高度 + 文本垂直对齐
    const cols = this.cellObjects[rowIndex].length;
    for (let col = 0; col < cols; col++) {
      const cellRect = this.cellObjects[rowIndex][col];
      const cellText = this.textObjects[rowIndex][col];
      if (cellRect) {
        cellRect.set('height', newRowHeight);
        cellRect.setCoords();
      }
      if (cellText) {
        const cell = this.tableData[rowIndex][col];
        const cellMargin = Array.isArray(cell.options?.margin)
          ? cell.options.margin[0]
          : cell.options?.margin !== undefined
            ? Number(cell.options.margin)
            : Array.isArray(margin)
              ? margin[0]
              : ((margin as number) ?? 4);

        const cellRectTop = this.cellObjects[rowIndex][col]?.top ?? 0; // 已相对 Group 中心
        const textHeight =
          cellText.height ||
          cellText.calcTextHeight() ||
          cellText.fontSize ||
          12;
        let textTop = cellRectTop + cellMargin;
        switch (cell.options?.valign || 'top') {
          case 'middle':
            textTop = cellRectTop + (newRowHeight - textHeight) / 2;
            break;
          case 'bottom':
            textTop = cellRectTop + newRowHeight - textHeight - cellMargin;
            break;
        }
        cellText.set('top', textTop);
        cellText.setCoords();
      }
    }

    // 3) 将其后所有行整体向下平移 heightDelta
    for (let r = rowIndex + 1; r < rowsCount; r++) {
      const nextCols = this.cellObjects[r].length;
      for (let c = 0; c < nextCols; c++) {
        const rect = this.cellObjects[r][c];
        const text = this.textObjects[r][c];
        if (rect) {
          rect.set('top', (rect.top ?? 0) + heightDelta);
          rect.setCoords();
        }
        if (text) {
          text.set('top', (text.top ?? 0) + heightDelta);
          text.setCoords();
        }
      }
    }

    // 4) 更新 rowH 与表格总高度（避免直接修改只读/冻结对象上的属性）
    const currentRowH = this.tableOptions.rowH;
    let nextRowHeights: number[];
    if (Array.isArray(currentRowH)) {
      nextRowHeights = [...currentRowH];
      nextRowHeights[rowIndex] = newRowHeight;
    } else {
      const base = typeof currentRowH === 'number' ? currentRowH : 50;
      nextRowHeights = new Array(this.tableData.length).fill(base);
      nextRowHeights[rowIndex] = newRowHeight;
    }
    // 以不可变方式替换 tableOptions，避免写入只读属性
    this.tableOptions = { ...this.tableOptions, rowH: nextRowHeights };

    // 以 rowH 求和为准，避免累计误差
    const totalHeight = (
      Array.isArray(this.tableOptions.rowH)
        ? this.tableOptions.rowH
        : new Array(this.tableData.length).fill(this.tableOptions.rowH || 50)
    ).reduce((s, h) => s + (h as number), 0);
    this.set('height', totalHeight);

    // 同步选择框边界，确保选择框包含所有增高后的元素
    this.syncSelectionBounds();
    this.canvas?.renderAll();
  }

  /**
   * 调整行高，根据该行文本的实际高度
   */
  private adjustRowHeight(rowIndex: number): void {
    if (!this.textObjects[rowIndex]) {
      return;
    }

    const row = this.textObjects[rowIndex];
    let maxHeight = 0;
    const margin = this.tableOptions.margin;
    const cellMargin = Array.isArray(margin)
      ? margin[0]
      : margin !== undefined
        ? Number(margin)
        : 4;

    // 找到该行中最高的文本
    row.forEach((cellText) => {
      if (cellText) {
        const textHeight = cellText.height || cellText.calcTextHeight() || 0;
        maxHeight = Math.max(maxHeight, textHeight);
      }
    });

    if (maxHeight === 0) {
      return;
    }

    // 计算新行高（文本高度 + margin * 2）
    const newRowHeight = maxHeight + cellMargin * 2;
    const oldRowHeight = this.cellObjects[rowIndex]?.[0]?.height || 0;

    // 如果新高度大于旧高度，走增量式更新逻辑
    if (newRowHeight > oldRowHeight) {
      // 标记边界缓存失效
      this.boundsCacheValid = false;
      this.applyRowHeightDelta(rowIndex, newRowHeight);
    }
  }

  /**
   * 同步选择框边界，确保包含所有子元素（包括高度变化后的）
   * 使用智能缓存机制，避免不必要的重计算
   */
  private syncSelectionBounds(): void {
    // 如果边界缓存有效，跳过重计算
    if (this.boundsCacheValid) {
      return;
    }
    // 1. 计算正确的总高度
    const rowHeights = Array.isArray(this.tableOptions.rowH)
      ? this.tableOptions.rowH
      : new Array(this.tableData.length).fill(this.tableOptions.rowH || 50);
    const totalHeight = rowHeights.reduce((sum, h) => sum + (h as number), 0);

    // 2. 计算正确的总宽度
    const columnWidths = Array.isArray(this.tableOptions.colW)
      ? this.tableOptions.colW
      : new Array(this.tableData[0]?.length || 0).fill(
          this.tableOptions.colW || 100,
        );
    const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);

    // 3. 只在尺寸确实变化时才更新
    const currentWidth = this.width || 0;
    const currentHeight = this.height || 0;

    if (
      Math.abs(currentWidth - totalWidth) < 1 &&
      Math.abs(currentHeight - totalHeight) < 1
    ) {
      // 尺寸没有显著变化，标记缓存有效并返回
      this.boundsCacheValid = true;
      return;
    }

    // 4. 更新 Group 的尺寸
    this.set({
      width: totalWidth,
      height: totalHeight,
    });

    // 5. 强制重新计算 Group 边界 - 只在必要时执行
    const anyThis: any = this as any;
    if (typeof anyThis._calcBounds === 'function') {
      anyThis._calcBounds();
    }

    // 6. 更新子对象坐标系统
    if (typeof anyThis._updateObjectsCoords === 'function') {
      anyThis._updateObjectsCoords();
    }

    // 7. 更新控制点位置
    this.setCoords();

    // 8. 标记为需要重新渲染并设置缓存有效
    anyThis.dirty = true;
    this.boundsCacheValid = true;
  }

  /**
   * 在 Group 级别设置事件监听器
   * 这样可以确保即使 FabricTable 被选中，事件仍然能正常工作
   */

  private setupGroupEventListeners(): void {
    // Group 单击：选中表格
    this.on('mousedown', (e: TEvent) => {
      const target = e.e.target;
      console.log('group mousedown', e);

      // 如果点击的是 textbox 且在编辑模式下，处理具体单元格编辑
      if (target && target instanceof Textbox && this.mode === 'edit') {
        const rowIndex = (target as any).cellRowIndex;
        const colIndex = (target as any).cellColIndex;
        if (typeof rowIndex === 'number' && typeof colIndex === 'number') {
          this.handleCellClick(rowIndex, colIndex, e);
          return;
        }
      }

      // 如果点击的是 textbox 且不在编辑模式，进入编辑模式
      if (target && target instanceof Textbox && this.mode !== 'edit') {
        this.mode = 'edit';
        // 进入编辑模式时保持表格移动功能
        this.set('selectable', true);
        this.set('evented', true);

        const rowIndex = (target as any).cellRowIndex;
        const colIndex = (target as any).cellColIndex;
        if (typeof rowIndex === 'number' && typeof colIndex === 'number') {
          this.handleCellClick(rowIndex, colIndex, e);
        }
        return;
      }

      // 点击表格其他区域，切换到选中状态
      if (this.mode === '') {
        this.mode = 'select';
        console.log('Table selected');
        if (this.canvas?.getActiveObject() !== this) {
          this.canvas?.setActiveObject(this);
          this.syncSelectionBounds();
          this.canvas?.requestRenderAll();
        }

        return;
      }

      // 在选中模式下点击子对象，提升为拖拽表格
      if (
        this.mode === 'select' &&
        target &&
        (target instanceof Textbox || target instanceof Rect)
      ) {
        if (this.canvas?.getActiveObject() !== this) {
          this.canvas?.setActiveObject(this);
        }
      }
    });

    // Group 双击：进入编辑模式
    this.on('mousedblclick', (e) => {
      if (this.mode === 'select') {
        this.mode = 'edit';
        console.log('Table entered edit mode');
        // 进入编辑模式时保持表格拖拽功能
        this.set('selectable', true);
        this.set('evented', true);

        this.canvas?.requestRenderAll();
      } else if (this.mode === 'edit') {
        // 双击表格空白处退出编辑模式
        const target = (e as any).target;
        if (!target || !(target instanceof Textbox)) {
          this.mode = 'select';
          console.log('Table exited edit mode');

          if (this.currentEditingCell) {
            const currentTextbox =
              this.textObjects[this.currentEditingCell.rowIndex]?.[
                this.currentEditingCell.colIndex
              ];
            if (currentTextbox?.isEditing) {
              currentTextbox.exitEditing();
            }
            this.currentEditingCell = null;
          }
          this.canvas?.requestRenderAll();
        }
      }
    });

    this.on('selected', () => {
      // 同步选择框高度，确保包含增高后的所有子元素
      this.syncSelectionBounds();
      this.canvas?.requestRenderAll();
    });
  }
  /**
   * 获取单元格文本
   */
  public getCellText(rowIndex: number, colIndex: number): string {
    if (this.textObjects[rowIndex] && this.textObjects[rowIndex][colIndex]) {
      return this.textObjects[rowIndex][colIndex].text || '';
    }
    return '';
  }

  /**
   * 添加行
   */
  public addRow(rowData: TableCell[], insertIndex?: number): void {
    const index =
      insertIndex !== undefined ? insertIndex : this.tableData.length;
    this.tableData.splice(index, 0, rowData);
    this.recreateTable();
  }

  /**
   * 删除行
   */
  public removeRow(rowIndex: number): void {
    if (rowIndex >= 0 && rowIndex < this.tableData.length) {
      this.tableData.splice(rowIndex, 1);
      this.recreateTable();
    }
  }

  /**
   * 添加列
   */
  public addColumn(columnData: TableCell[], insertIndex?: number): void {
    const index =
      insertIndex !== undefined ? insertIndex : this.tableData[0].length;
    this.tableData.forEach((row, rowIndex) => {
      row.splice(index, 0, columnData[rowIndex] || { text: '' });
    });
    this.recreateTable();
  }

  /**
   * 删除列
   */
  public removeColumn(colIndex: number): void {
    if (colIndex >= 0 && colIndex < this.tableData[0].length) {
      this.tableData.forEach((row) => {
        row.splice(colIndex, 1);
      });
      this.recreateTable();
    }
  }

  /**
   * 删除这个表格 从画布中删除
   */
  public deleteTable(): void {
    // 清理所有对象
    this.cellObjects = [];
    this.textObjects = [];

    // 销毁表格对象 - 清理所有子对象
    this.getObjects().forEach((obj) => {
      if (obj.canvas) {
        obj.canvas.remove(obj);
      }
    });
    // 从画布中移除表格
    if (this.canvas) {
      this.canvas.remove(this);
    }
  }

  /**
   * 重新创建表格
   */
  private recreateTable(): void {
    // 清除现有对象 - 移除所有子对象
    // 注意：在 createTable 内部已经包含了 this.remove(obj) 的逻辑
    // 避免重复操作

    this.createTable();

    // 重新计算并设置尺寸，确保选择框正确
    this.syncSelectionBounds();
    this.canvas?.renderAll();
  }

  /**
   * 导出表格数据
   */
  public exportData(): { tableData: TableRow[]; tableOptions: TableOptions } {
    return {
      tableData: this.tableData,
      tableOptions: this.tableOptions,
    };
  }

  /**
   * 将 FabricTable 转换为 JSON 对象（序列化）
   * 关键：确保自定义属性也被序列化
   */
  public toObject(propertiesToInclude: string[] = []): any {
    // 包含 data 属性用于识别表格类型
    const defaultKeys = ['data', 'tableData', 'tableOptions'];
    const keysToInclude = [...defaultKeys, ...propertiesToInclude];

    return super.toObject(keysToInclude);
  }

  /**
   * 从数据创建表格
   */
  public static fromData(
    data: { tableData: TableRow[]; tableOptions: TableOptions },
    canvas?: Canvas,
  ): FabricTable {
    return new FabricTable(data.tableData, data.tableOptions, canvas);
  }
}

// 注册 FabricTable 到 fabric 对象，支持 fromObject 序列化/反序列化
// 这允许 canvas.loadFromJSON 正确恢复 FabricTable 对象
// FabricTable 反序列化支持，返回 Promise，不再 callback
(FabricTable as any).fromObject = async (object: any, callback?: Function) => {
  const { tableData, tableOptions, data } = object;
  if (data === 'FabricTable' && tableData && tableOptions) {
    // 创建可变的副本，避免只读属性错误
    const mutableTableData = JSON.parse(JSON.stringify(tableData));
    const mutableTableOptions = JSON.parse(JSON.stringify(tableOptions));

    // 创建新的FabricTable实例
    const table = new FabricTable(mutableTableData, mutableTableOptions);

    // 复制其他属性
    for (const key in object) {
      if (
        key !== 'tableData' &&
        key !== 'tableOptions' &&
        key !== 'data' &&
        key !== 'objects'
      ) {
        try {
          (table as any)[key] = object[key];
        } catch (err) {
          // 忽略只读属性的赋值错误
          console.warn(`Failed to set property ${key}:`, err);
        }
      }
    }

    // 确保在下一个tick中调用初始化
    setTimeout(() => {
      table.initializeAfterDeserialization();
    }, 0);

    if (callback) callback(table);
    return table;
  }
  if (callback) callback(null);
  return null;
};
classRegistry.setClass(FabricTable, 'FabricTable');

// v6: Use proper class registration instead of modifying util.objectEnliveners
// The util object is frozen in v6 and cannot be extended
// Custom object deserialization is handled through fromObject static method
// which is already defined above and registered with classRegistry
