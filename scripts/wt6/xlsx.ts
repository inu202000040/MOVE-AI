import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

export type XlsxScalar = string | number | boolean | null;
export type XlsxRow = readonly XlsxScalar[];

export interface XlsxSheet {
  readonly name: string;
  readonly rows: readonly XlsxRow[];
}

export interface XlsxWorkbook {
  readonly sheets: ReadonlyMap<string, XlsxSheet>;
}

interface ZipEntry {
  readonly compressionMethod: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly localHeaderOffset: number;
}

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;

function findEndOfCentralDirectory(bytes: Buffer): number {
  const lowerBound = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= lowerBound; offset -= 1) {
    if (bytes.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }
  throw new Error("Invalid XLSX: ZIP end-of-central-directory was not found");
}

function readZipDirectory(bytes: Buffer): ReadonlyMap<string, ZipEntry> {
  const endOffset = findEndOfCentralDirectory(bytes);
  const entryCount = bytes.readUInt16LE(endOffset + 10);
  let offset = bytes.readUInt32LE(endOffset + 16);
  const entries = new Map<string, ZipEntry>();

  for (let index = 0; index < entryCount; index += 1) {
    if (bytes.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`Invalid XLSX: bad central directory entry at ${offset}`);
    }
    const compressionMethod = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const fileNameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localHeaderOffset = bytes.readUInt32LE(offset + 42);
    const fileName = bytes
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8")
      .replaceAll("\\", "/");

    if (entries.has(fileName)) {
      throw new Error(`Invalid XLSX: duplicate ZIP entry ${fileName}`);
    }
    entries.set(fileName, {
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipEntry(
  bytes: Buffer,
  directory: ReadonlyMap<string, ZipEntry>,
  name: string,
): Buffer {
  const entry = directory.get(name);
  if (!entry) {
    throw new Error(`Invalid XLSX: missing ZIP entry ${name}`);
  }
  const offset = entry.localHeaderOffset;
  if (bytes.readUInt32LE(offset) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error(`Invalid XLSX: bad local file header for ${name}`);
  }
  const fileNameLength = bytes.readUInt16LE(offset + 26);
  const extraLength = bytes.readUInt16LE(offset + 28);
  const start = offset + 30 + fileNameLength + extraLength;
  const compressed = bytes.subarray(start, start + entry.compressedSize);
  let result: Buffer;
  if (entry.compressionMethod === 0) {
    result = Buffer.from(compressed);
  } else if (entry.compressionMethod === 8) {
    result = inflateRawSync(compressed);
  } else {
    throw new Error(
      `Invalid XLSX: unsupported ZIP compression method ${entry.compressionMethod}`,
    );
  }
  if (result.length !== entry.uncompressedSize) {
    throw new Error(`Invalid XLSX: decompressed size mismatch for ${name}`);
  }
  return result;
}

function decodeXmlText(value: string): string {
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|amp|apos|gt|lt|quot);/giu,
    (entity, decimal: string | undefined, hexadecimal: string | undefined) => {
      if (decimal !== undefined) return String.fromCodePoint(Number(decimal));
      if (hexadecimal !== undefined) {
        return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      }
      switch (entity) {
        case "&amp;":
          return "&";
        case "&apos;":
          return "'";
        case "&gt;":
          return ">";
        case "&lt;":
          return "<";
        case "&quot;":
          return '"';
        default:
          throw new Error(`Invalid XLSX: unsupported XML entity ${entity}`);
      }
    },
  );
}

function xmlAttribute(tag: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`, "u").exec(tag);
  return match ? decodeXmlText(match[1]) : null;
}

function xmlTextFragments(xml: string): string {
  const fragments: string[] = [];
  for (const match of xml.matchAll(
    /<(?:[\w.-]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?t>/gu,
  )) {
    fragments.push(decodeXmlText(match[1]));
  }
  return fragments.join("");
}

function parseSharedStrings(xml: string): readonly string[] {
  const values: string[] = [];
  for (const match of xml.matchAll(
    /<(?:[\w.-]+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?si>/gu,
  )) {
    values.push(xmlTextFragments(match[1]));
  }
  return values;
}

function columnIndex(cellReference: string): number {
  const letters = /^[A-Z]+/u.exec(cellReference)?.[0];
  if (!letters) throw new Error(`Invalid XLSX cell reference ${cellReference}`);
  let result = 0;
  for (const character of letters) {
    result = result * 26 + character.charCodeAt(0) - 64;
  }
  return result - 1;
}

function parseCellValue(
  cellTag: string,
  body: string,
  sharedStrings: readonly string[],
): XlsxScalar {
  const type = xmlAttribute(cellTag, "t");
  if (type === "inlineStr") return xmlTextFragments(body);
  const raw = /<(?:[\w.-]+:)?v(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?v>/u.exec(
    body,
  )?.[1];
  if (raw === undefined) return null;
  const value = decodeXmlText(raw);
  if (type === "s") {
    const index = Number(value);
    const shared = sharedStrings[index];
    if (!Number.isInteger(index) || shared === undefined) {
      throw new Error(`Invalid XLSX shared-string index ${value}`);
    }
    return shared;
  }
  if (type === "b") {
    if (value === "1") return true;
    if (value === "0") return false;
    throw new Error(`Invalid XLSX boolean ${value}`);
  }
  if (type === "str" || type === "e" || type === "d") return value;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid XLSX numeric cell ${value} type=${type ?? "null"} tag=${cellTag}`);
  }
  return number;
}

function parseWorksheet(xml: string, sharedStrings: readonly string[]): XlsxRow[] {
  const rows: XlsxRow[] = [];
  for (const rowMatch of xml.matchAll(
    /<(?:[\w.-]+:)?row(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?row>/gu,
  )) {
    const row: XlsxScalar[] = [];
    for (const cellMatch of rowMatch[1].matchAll(
      /(<(?:[\w.-]+:)?c\b[^>]*?)(?:\s*\/>|>([\s\S]*?)<\/(?:[\w.-]+:)?c>)/gu,
    )) {
      const reference = xmlAttribute(cellMatch[1], "r");
      if (!reference) throw new Error("Invalid XLSX: cell without reference");
      const index = columnIndex(reference);
      while (row.length < index) row.push(null);
      row[index] = parseCellValue(cellMatch[1], cellMatch[2] ?? "", sharedStrings);
    }
    while (row.length > 0 && row.at(-1) === null) row.pop();
    rows.push(row);
  }
  return rows;
}

function resolveWorksheetPath(target: string): string {
  const normalized = target.replaceAll("\\", "/").replace(/^\//u, "");
  return normalized.startsWith("xl/") ? normalized : `xl/${normalized}`;
}

export async function readXlsx(
  filePath: string,
  allowedSheets: readonly string[],
): Promise<XlsxWorkbook> {
  const bytes = await readFile(filePath);
  const directory = readZipDirectory(bytes);
  const workbookXml = readZipEntry(
    bytes,
    directory,
    "xl/workbook.xml",
  ).toString("utf8");
  const relationshipsXml = readZipEntry(
    bytes,
    directory,
    "xl/_rels/workbook.xml.rels",
  ).toString("utf8");
  const sharedStrings = directory.has("xl/sharedStrings.xml")
    ? parseSharedStrings(
        readZipEntry(bytes, directory, "xl/sharedStrings.xml").toString("utf8"),
      )
    : [];

  const relationships = new Map<string, string>();
  for (const match of relationshipsXml.matchAll(
    /<(?:[\w.-]+:)?Relationship\s[^>]*\/>/gu,
  )) {
    const id = xmlAttribute(match[0], "Id");
    const target = xmlAttribute(match[0], "Target");
    if (id && target) relationships.set(id, resolveWorksheetPath(target));
  }

  const sheets = new Map<string, XlsxSheet>();
  const allowed = new Set(allowedSheets);
  for (const match of workbookXml.matchAll(
    /<(?:[\w.-]+:)?sheet\s[^>]*\/>/gu,
  )) {
    const name = xmlAttribute(match[0], "name");
    const relationshipId = xmlAttribute(match[0], "r:id");
    if (!name || !relationshipId) {
      throw new Error("Invalid XLSX: malformed workbook sheet entry");
    }
    if (!allowed.has(name)) continue;
    const worksheetPath = relationships.get(relationshipId);
    if (!worksheetPath) {
      throw new Error(`Invalid XLSX: missing relationship ${relationshipId}`);
    }
    if (sheets.has(name)) throw new Error(`Invalid XLSX: duplicate sheet ${name}`);
    const worksheetXml = readZipEntry(bytes, directory, worksheetPath).toString(
      "utf8",
    );
    sheets.set(name, { name, rows: parseWorksheet(worksheetXml, sharedStrings) });
  }
  for (const name of allowed) {
    if (!sheets.has(name)) throw new Error(`Invalid XLSX: missing allowed sheet ${name}`);
  }
  return { sheets };
}

export type TableRecord = Readonly<Record<string, XlsxScalar>>;

export function readTable(
  workbook: XlsxWorkbook,
  sheetName: string,
): readonly TableRecord[] {
  const sheet = workbook.sheets.get(sheetName);
  if (!sheet) throw new Error(`Missing approved sheet ${sheetName}`);
  const headerRowIndex = sheet.rows
    .slice(0, 10)
    .map((row, index) => ({
      index,
      count: row.filter(
        (cell) => typeof cell === "string" && cell.trim() !== "",
      ).length,
    }))
    .sort((left, right) => right.count - left.count || left.index - right.index)[0]?.index ?? -1;
  if (headerRowIndex < 0) throw new Error(`Empty approved sheet ${sheetName}`);
  const headers = sheet.rows[headerRowIndex].map((cell) => {
    if (typeof cell !== "string" || cell.trim() === "") {
      throw new Error(`Invalid header in ${sheetName}`);
    }
    return cell.trim();
  });
  if (new Set(headers).size !== headers.length) {
    throw new Error(`Duplicate header in ${sheetName}`);
  }

  return sheet.rows.slice(headerRowIndex + 1).flatMap((row) => {
    if (row.every((cell) => cell === null || cell === "")) return [];
    const record: Record<string, XlsxScalar> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? null;
    });
    return [record];
  });
}
