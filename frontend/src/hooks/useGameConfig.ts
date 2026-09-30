import { useEffect, useState } from 'react';
import { api } from '../api';
import type { GameConfig } from '../types';

// Uma unica busca por carregamento da pagina, compartilhada entre os componentes
let configRequest: Promise<GameConfig> | null = null;

/** Regras do jogo definidas no servidor (preco da chave, minimo de jogadores, intervalo das rodadas). */
export function useGameConfig(): GameConfig | null {
  const [config, setConfig] = useState<GameConfig | null>(null);

  useEffect(() => {
    configRequest ??= api.getConfig().catch((err) => {
      configRequest = null;
      throw err;
    });
    let active = true;
    configRequest.then((value) => active && setConfig(value)).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return config;
}
