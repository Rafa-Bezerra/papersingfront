export type Anexo = {
    id: number,
    idmov: number,
    anexo: string,
    nome: string
}

export type AnexoUpload = {
    idmov: number,
    anexo: string,
    nome: string
}

export type AnexoAssinar = {
    id: number
    anexo: string
    pagina: number
    posX: number
    posY: number
    largura: number
    altura: number
}