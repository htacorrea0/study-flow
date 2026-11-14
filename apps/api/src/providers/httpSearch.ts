/**
 * O pouco de HTTP que as buscas compartilham.
 *
 * `fetch` é nativo no Node 20, então nada é instalado para isto. O que vale a
 * pena centralizar é o cuidado: tempo limite, para que uma API lenta não
 * segure a requisição de quem só quer ver o dia; e a regra de que a chave
 * nunca aparece em log nem em mensagem de erro.
 */

const TEMPO_LIMITE_MS = 6000;

/** Busca JSON e devolve `null` em qualquer falha. Nunca lança. */
export async function buscarJson(
  url: URL,
  rotulo: string,
): Promise<Record<string, unknown> | null> {
  const controle = new AbortController();
  const alarme = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

  try {
    const resposta = await fetch(url, { signal: controle.signal });

    if (!resposta.ok) {
      // Só o código: o corpo de erro do Google ecoa a URL, e a URL tem a chave.
      console.error(`[busca:${rotulo}] resposta ${resposta.status}`);
      return null;
    }

    return (await resposta.json()) as Record<string, unknown>;
  } catch (error) {
    console.error(`[busca:${rotulo}] falhou:`, semSegredo(error));
    return null;
  } finally {
    clearTimeout(alarme);
  }
}

/**
 * A mensagem de uma falha, sem a chave.
 *
 * Mensagem de erro de rede às vezes carrega a URL inteira, e a URL carrega a
 * chave. Em log a chave é um vazamento: fica no terminal, no arquivo e em
 * qualquer coletor que leia os dois.
 */
function semSegredo(error: unknown): string {
  const mensagem = error instanceof Error ? error.message : 'erro desconhecido';

  return mensagem.replace(/(key|cx)=[^&\s]+/gi, '$1=***');
}

/** Texto de um campo possivelmente ausente, já sem espaço sobrando. */
export function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}
