// El Garaje - el primer fotograma de un GIF animado, como GIF fijo.
//
// No decodifica nada: copia la cabecera, la paleta y el primer bloque de
// imagen tal cual y cierra el archivo. Sirve para mostrar un ejercicio quieto
// donde una animacion en bucle no tiene sitio (la portada).

export function primerFotograma(buf) {
  if (buf.length < 13 || buf.toString("ascii", 0, 3) !== "GIF") return null;
  let i = 13;
  const flags = buf[10];
  if (flags & 0x80) i += 3 * (1 << ((flags & 0x07) + 1));
  const partes = [buf.subarray(0, i)];

  const saltarSubbloques = (j) => {
    while (j < buf.length && buf[j] !== 0) j += buf[j] + 1;
    return j + 1;
  };

  while (i < buf.length) {
    const tipo = buf[i];
    if (tipo === 0x21) {
      // extension: se conserva la de control grafico (transparencia), el resto fuera
      const etiqueta = buf[i + 1];
      const fin = saltarSubbloques(i + 2);
      if (etiqueta === 0xf9) partes.push(buf.subarray(i, fin));
      i = fin;
    } else if (tipo === 0x2c) {
      let j = i + 10;
      const f = buf[i + 9];
      if (f & 0x80) j += 3 * (1 << ((f & 0x07) + 1));
      j += 1; // tamano minimo de codigo LZW
      const fin = saltarSubbloques(j);
      partes.push(buf.subarray(i, fin), Buffer.from([0x3b]));
      return Buffer.concat(partes);
    } else {
      return null;
    }
  }
  return null;
}
