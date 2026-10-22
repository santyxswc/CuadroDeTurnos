// Persistencia en archivos JSON (ADR-010). No hay base de datos.
// Reglas: solo la API escribe; escritura atómica (.tmp + rename); una escritura a la vez por archivo;
// el contenido se mantiene en memoria y se sirve desde ahí.
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Serializa operaciones asíncronas: cada una empieza cuando termina la anterior. */
export class Cola {
  private ultima: Promise<unknown> = Promise.resolve();

  ejecutar<T>(tarea: () => Promise<T>): Promise<T> {
    const resultado = this.ultima.then(tarea, tarea);
    // La cola sigue aunque una tarea falle; el error lo recibe quien la pidió.
    this.ultima = resultado.catch(() => undefined);
    return resultado;
  }
}

export async function escribirAtomico(ruta: string, contenido: string): Promise<void> {
  await mkdir(dirname(ruta), { recursive: true });
  const temporal = `${ruta}.tmp`;
  await writeFile(temporal, contenido, 'utf8');
  // rename reemplaza el archivo de una sola vez: nunca queda un JSON a medio escribir.
  await rename(temporal, ruta);
}

/** Un archivo JSON cuyo contenido completo vive en memoria. */
export class ArchivoJson<T> {
  private valor!: T;
  private cargado = false;
  private readonly cola = new Cola();

  constructor(
    readonly ruta: string,
    private readonly valorInicial: () => T,
  ) {}

  async cargar(): Promise<void> {
    try {
      this.valor = JSON.parse(await readFile(this.ruta, 'utf8')) as T;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`No se pudo leer ${this.ruta}: ${(e as Error).message}`);
      }
      this.valor = this.valorInicial();
    }
    this.cargado = true;
  }

  leer(): T {
    if (!this.cargado) throw new Error(`${this.ruta} no se ha cargado`);
    return this.valor;
  }

  /**
   * Aplica un cambio y lo guarda en disco. Los cambios se aplican en orden, uno a la vez.
   * Si la escritura falla, la memoria vuelve al valor anterior.
   */
  modificar<R>(cambio: (actual: T) => { valor: T; resultado: R }): Promise<R> {
    return this.cola.ejecutar(async () => {
      const anterior = this.leer();
      const { valor, resultado } = cambio(structuredClone(anterior));
      await escribirAtomico(this.ruta, JSON.stringify(valor, null, 2));
      this.valor = valor;
      return resultado;
    });
  }
}

export interface ConId {
  id: string;
}

/** Colección de documentos guardada como un arreglo en un archivo JSON. */
export class ColeccionJson<T extends ConId> {
  private readonly archivo: ArchivoJson<T[]>;

  constructor(ruta: string) {
    this.archivo = new ArchivoJson<T[]>(ruta, () => []);
  }

  cargar() {
    return this.archivo.cargar();
  }

  /** Copias de los documentos, para que nadie modifique la memoria sin pasar por el disco. */
  todos(): T[] {
    return structuredClone(this.archivo.leer());
  }

  buscar(predicado: (d: T) => boolean): T | undefined {
    const d = this.archivo.leer().find(predicado);
    return d && structuredClone(d);
  }

  filtrar(predicado: (d: T) => boolean): T[] {
    return structuredClone(this.archivo.leer().filter(predicado));
  }

  obtener(id: string): T | undefined {
    return this.buscar((d) => d.id === id);
  }

  insertar(doc: T): Promise<T> {
    return this.archivo.modificar((lista) => {
      if (lista.some((d) => d.id === doc.id)) throw new Error(`Ya existe un documento con id ${doc.id}`);
      return { valor: [...lista, doc], resultado: structuredClone(doc) };
    });
  }

  insertarVarios(docs: T[]): Promise<void> {
    return this.archivo.modificar((lista) => ({ valor: [...lista, ...docs], resultado: undefined }));
  }

  /** Actualiza un documento; `cambio` recibe una copia y devuelve la versión nueva. */
  actualizar(id: string, cambio: (actual: T) => T): Promise<T | undefined> {
    return this.archivo.modificar((lista) => {
      const i = lista.findIndex((d) => d.id === id);
      if (i < 0) return { valor: lista, resultado: undefined };
      const nuevo = cambio(lista[i]);
      lista[i] = nuevo;
      return { valor: lista, resultado: structuredClone(nuevo) };
    });
  }

  eliminar(id: string): Promise<boolean> {
    return this.archivo.modificar((lista) => {
      const resto = lista.filter((d) => d.id !== id);
      return { valor: resto, resultado: resto.length !== lista.length };
    });
  }
}

/** Archivo JSON Lines de solo agregar (auditoría): una línea por evento, nunca se reescribe. */
export class RegistroJsonl<T> {
  private readonly cola = new Cola();

  constructor(readonly ruta: string) {}

  agregar(evento: T): Promise<void> {
    return this.cola.ejecutar(async () => {
      await mkdir(dirname(this.ruta), { recursive: true });
      await appendFile(this.ruta, `${JSON.stringify(evento)}\n`, 'utf8');
    });
  }

  /** Últimos eventos, del más reciente al más antiguo. */
  async ultimos(cantidad: number): Promise<T[]> {
    let texto: string;
    try {
      texto = await readFile(this.ruta, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
    return texto
      .split('\n')
      .filter(Boolean)
      .slice(-cantidad)
      .reverse()
      .map((l) => JSON.parse(l) as T);
  }
}
