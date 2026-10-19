// Último mensaje del chat que la persona ya vio, para el contador de no leídos (RF-CHAT-02).
// Se guarda en el equipo; si no se puede leer, se toma como que no hay nada pendiente de ver.
const clave = (usuarioId: string) => `sgt.chat.leido.${usuarioId}`;

export function ultimoLeido(usuarioId: string): string | null {
  try {
    return localStorage.getItem(clave(usuarioId));
  } catch {
    return null;
  }
}

export function marcarLeido(usuarioId: string, creadoEn: string) {
  try {
    if ((localStorage.getItem(clave(usuarioId)) ?? '') < creadoEn) localStorage.setItem(clave(usuarioId), creadoEn);
  } catch {
    // Sin almacenamiento local el contador simplemente no se guarda.
  }
}
