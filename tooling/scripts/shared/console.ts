export type TerminalStyle =
  | "blue"
  | "bold"
  | "cyan"
  | "dim"
  | "green"
  | "magenta"
  | "red"
  | "yellow"

export interface TableColumn<Row> {
  readonly align?: "left" | "right"
  readonly header: string
  readonly style?: TerminalStyle | ((row: Row) => TerminalStyle | undefined)
  readonly value: (row: Row) => number | string
}

export interface TableOptions {
  readonly colors?: boolean
}

const codes: Readonly<Record<TerminalStyle, number>> = {
  blue: 34,
  bold: 1,
  cyan: 36,
  dim: 2,
  green: 32,
  magenta: 35,
  red: 31,
  yellow: 33,
}

const forcedColor = process.env.FORCE_COLOR
export const terminalColorsEnabled =
  process.env.NO_COLOR === undefined &&
  forcedColor !== "0" &&
  (forcedColor !== undefined || process.stdout.isTTY === true)

const escapeCharacter = String.fromCharCode(27)
const ansiPattern = new RegExp(`${escapeCharacter}\\[[0-9;]*m`, "gu")

export const stripAnsi = (value: string): string => value.replace(ansiPattern, "")

const visibleLength = (value: string): number => [...stripAnsi(value)].length

export const styleText = (
  value: string,
  style: TerminalStyle,
  colors = terminalColorsEnabled,
): string => (colors ? `${escapeCharacter}[${codes[style]}m${value}${escapeCharacter}[0m` : value)

const padCell = (value: string, width: number, align: "left" | "right"): string => {
  const padding = " ".repeat(Math.max(0, width - visibleLength(value)))
  return align === "right" ? `${padding}${value}` : `${value}${padding}`
}

export const renderTable = <Row>(
  rows: readonly Row[],
  columns: readonly TableColumn<Row>[],
  options: TableOptions = {},
): string => {
  const colors = options.colors ?? terminalColorsEnabled
  const values = rows.map((row) => columns.map((column) => String(column.value(row))))
  const widths = columns.map((column, columnIndex) =>
    Math.max(
      visibleLength(column.header),
      ...values.map((row) => visibleLength(row[columnIndex] ?? "")),
    ),
  )
  const border = (left: string, middle: string, right: string): string =>
    styleText(
      `${left}${widths.map((width) => "─".repeat(width + 2)).join(middle)}${right}`,
      "dim",
      colors,
    )
  const renderRow = (cells: readonly string[], row?: Row): string => {
    const output = cells.map((cell, index) => {
      const column = columns[index]
      if (!column) return cell
      const padded = ` ${padCell(cell, widths[index] ?? 0, column.align ?? "left")} `
      if (row === undefined) return styleText(padded, "bold", colors)
      const cellStyle = typeof column.style === "function" ? column.style(row) : column.style
      return cellStyle ? styleText(padded, cellStyle, colors) : padded
    })
    return `${styleText("│", "dim", colors)}${output.join(styleText("│", "dim", colors))}${styleText("│", "dim", colors)}`
  }

  return [
    border("┌", "┬", "┐"),
    renderRow(columns.map((column) => column.header)),
    border("├", "┼", "┤"),
    ...values.map((cells, index) => renderRow(cells, rows[index])),
    border("└", "┴", "┘"),
  ].join("\n")
}

export const terminal = {
  detail(label: string, value: string): void {
    console.log(`  ${styleText(label.padEnd(10), "dim")} ${value}`)
  },
  error(message: string): void {
    console.error(`${styleText("✗", "red")} ${styleText(message, "red")}`)
  },
  heading(message: string): void {
    console.log(`\n${styleText("◆", "cyan")} ${styleText(message, "bold")}`)
  },
  info(message: string): void {
    console.log(`${styleText("●", "blue")} ${message}`)
  },
  success(message: string): void {
    console.log(`${styleText("✓", "green")} ${styleText(message, "green")}`)
  },
  table<Row>(rows: readonly Row[], columns: readonly TableColumn<Row>[]): void {
    console.log(renderTable(rows, columns))
  },
  warning(message: string): void {
    console.warn(`${styleText("!", "yellow")} ${styleText(message, "yellow")}`)
  },
}
