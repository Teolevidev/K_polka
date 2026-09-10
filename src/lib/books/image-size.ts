/**
 * Размер картинки из ее собственного заголовка.
 *
 * Нужен там, где нельзя доверять источнику на слово: Content-Length
 * говорит про байты, а решать приходится по пикселям. Разбираются три
 * формата, которыми отдают обложки книжные каталоги.
 */
export interface ImageSize {
  width: number;
  height: number;
}

export function readImageSize(buf: Buffer): ImageSize | null {
  // PNG: ширина и высота лежат в IHDR сразу после подписи.
  if (buf.length > 24 && buf.toString('ascii', 1, 4) === 'PNG') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // GIF: little-endian, сразу после версии.
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  // JPEG: идем по сегментам до маркера SOF, в нем и лежат размеры.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buf[offset + 1];
      // SOF0..SOF15, кроме DHT (c4), JPGA (c8) и DAC (cc).
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof) {
        return {
          height: buf.readUInt16BE(offset + 5),
          width: buf.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + buf.readUInt16BE(offset + 2);
    }
  }

  return null;
}

/**
 * Похоже ли это на обложку книги.
 *
 * Каталоги под видом обложки отдают что угодно: отсканированный
 * титульный лист, широкий разворот, полоску-заглушку. Карточка
 * кадрирует картинку по соотношению 2:3, и такой «обложкой» на экране
 * оказывается гигантский кусок буквы вместо книги.
 *
 * Границы намеренно широкие: у обычной книги отношение высоты к ширине
 * около 1.5, у альбомов и аудиокниг бывает почти квадрат, у карманных
 * изданий - вытянутее. Отсекаем только явно не книги.
 */
export function looksLikeCover(size: ImageSize | null): boolean {
  if (!size) return true; // формат не разобрали - не мешаем
  if (size.width < 80 || size.height < 100) return false;
  const ratio = size.height / size.width;
  return ratio >= 1.05 && ratio <= 2.2;
}
