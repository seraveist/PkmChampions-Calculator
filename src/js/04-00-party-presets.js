const PARTY_PRESET_STORAGE_KEY = 'pkmChampions.partyPresets.v1';
const PARTY_PRESET_MAX_PARTIES = 10;
const PARTY_PRESET_MAX_MEMBERS = 6;
const PARTY_PRESET_STAT_LABEL = { hp: 'H', atk: 'A', def: 'B', spa: 'C', spd: 'D', spe: 'S' };
const PARTY_PRESET_SHOWDOWN_STAT_LABEL = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
const PARTY_PRESET_MAX_NAME_LENGTH = 32;
const PARTY_PRESET_IMAGE_WIDTH = 1200;
const PARTY_PRESET_IMAGE_HEIGHT = 800;
const PARTY_PRESET_IMAGE_OUTPUT_SCALE = 2;
const PARTY_PRESET_IMAGE_CARD_COLUMNS = 3;
const PARTY_PRESET_IMAGE_CARD_ROWS = 2;
const PARTY_PRESET_LABELS = {
  party: '\uD30C\uD2F0',
  ability: '\uD2B9\uC131',
  item: '\uB3C4\uAD6C',
  nature: '\uC131\uACA9',
  evs: '\uB178\uB825\uCE58',
  empty: '\uC5C6\uC74C',
  emptySlot: '\uBE44\uC5B4 \uC788\uC74C',
  imageExport: '\uC774\uBBF8\uC9C0 \uCD9C\uB825',
};
const PARTY_PRESET_MOVE_TYPE_COLORS = {
  Normal: { bg: '#9a9a7a', fg: '#ffffff' },
  Fire: { bg: '#e6743c', fg: '#ffffff' },
  Water: { bg: '#5f8ee0', fg: '#ffffff' },
  Grass: { bg: '#6ab04c', fg: '#ffffff' },
  Electric: { bg: '#e8c42e', fg: '#1a1a1a' },
  Ice: { bg: '#7ec8d0', fg: '#1a1a1a' },
  Fighting: { bg: '#b33a2e', fg: '#ffffff' },
  Poison: { bg: '#9a4ea0', fg: '#ffffff' },
  Ground: { bg: '#d4b06a', fg: '#1a1a1a' },
  Flying: { bg: '#9a86e8', fg: '#ffffff' },
  Psychic: { bg: '#f05580', fg: '#ffffff' },
  Bug: { bg: '#a4b42a', fg: '#ffffff' },
  Rock: { bg: '#ac9540', fg: '#ffffff' },
  Ghost: { bg: '#6a5598', fg: '#ffffff' },
  Dragon: { bg: '#6838e0', fg: '#ffffff' },
  Dark: { bg: '#5e4a3c', fg: '#ffffff' },
  Steel: { bg: '#a8a8c0', fg: '#1a1a1a' },
  Fairy: { bg: '#e892b8', fg: '#1a1a1a' },
  Stellar: { bg: '#8368d8', fg: '#ffffff' },
};
const PARTY_PRESET_SHOWDOWN_STAT_ALIAS = {
  hp: 'hp', h: 'hp',
  atk: 'atk', attack: 'atk', a: 'atk',
  def: 'def', defense: 'def', b: 'def',
  spa: 'spa', spatk: 'spa', spattack: 'spa', specialattack: 'spa', c: 'spa',
  spd: 'spd', spdef: 'spd', spdefense: 'spd', specialdefense: 'spd', d: 'spd',
  spe: 'spe', speed: 'spe', s: 'spe',
};

let partyPresetData = loadPartyPresetData();
let partyPresetModalReady = false;
let partyPresetTextState = { partyIndex: 0, mode: 'import' };
let partyPresetPickerTarget = '';
const partyPresetCollapsedParties = new Set(Array.from({ length: PARTY_PRESET_MAX_PARTIES }, (_, index) => index));
const partyPresetExpandedSlots = new Set();

function partyPresetSlotCollapseKey(partyIndex, slotIndex) {
  return `${partyIndex}:${slotIndex}`;
}

function partyPresetDefaultName(partyIndex) {
  return `${PARTY_PRESET_LABELS.party} ${partyIndex + 1}`;
}

function normalizePartyPresetName(name, partyIndex) {
  const text = String(name || '').trim().slice(0, PARTY_PRESET_MAX_NAME_LENGTH);
  return text || partyPresetDefaultName(partyIndex);
}

function blankPartyPresetMember() {
  return {
    pokemon: '',
    ability: '',
    item: '',
    nature: 'hardy',
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: ['', '', '', ''],
  };
}

function blankPartyPresetData() {
  return {
    version: 1,
    parties: Array.from({ length: PARTY_PRESET_MAX_PARTIES }, (_, index) => ({
      name: partyPresetDefaultName(index),
      members: Array.from({ length: PARTY_PRESET_MAX_MEMBERS }, blankPartyPresetMember),
    })),
  };
}

function normalizePartyPresetMember(member = {}) {
  const evs = {};
  STATS.forEach(stat => {
    const value = Number(member.evs?.[stat] ?? 0);
    evs[stat] = Math.max(0, Math.min(32, Number.isFinite(value) ? value : 0));
  });
  const moves = Array.from({ length: 4 }, (_, index) => member.moves?.[index] || '');
  return {
    pokemon: PokemonById[member.pokemon] ? member.pokemon : '',
    ability: member.ability && AbilityById[member.ability] ? member.ability : '',
    item: member.item && ItemById[member.item] ? member.item : '',
    nature: NATURE_BY_ID[member.nature] ? member.nature : 'hardy',
    evs,
    moves,
  };
}

function normalizePartyPresetData(data) {
  const fallback = blankPartyPresetData();
  const parties = Array.from({ length: PARTY_PRESET_MAX_PARTIES }, (_, partyIndex) => {
    const party = data?.parties?.[partyIndex] || {};
    return {
      name: normalizePartyPresetName(party.name, partyIndex),
      members: Array.from({ length: PARTY_PRESET_MAX_MEMBERS }, (_, slotIndex) => (
        normalizePartyPresetMember(party.members?.[slotIndex] || fallback.parties[partyIndex].members[slotIndex])
      )),
    };
  });
  return { version: 1, parties };
}

function loadPartyPresetData() {
  try {
    const raw = localStorage.getItem(PARTY_PRESET_STORAGE_KEY);
    if (!raw) return blankPartyPresetData();
    return normalizePartyPresetData(JSON.parse(raw));
  } catch {
    return blankPartyPresetData();
  }
}

function savePartyPresetData() {
  try {
    localStorage.setItem(PARTY_PRESET_STORAGE_KEY, JSON.stringify(partyPresetData));
  } catch {
    // localStorage unavailable: keep the in-memory data for the current session.
  }
}

function setPartyPresetStatus(message = '', tone = '') {
  const status = document.getElementById('partyPresetStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone || '';
}

function partyPresetExportPayload() {
  const normalized = normalizePartyPresetData(partyPresetData);
  return {
    format: 'pokechamps-lab-party-presets',
    version: 1,
    exportedAt: new Date().toISOString(),
    parties: normalized.parties,
  };
}

function partyPresetDownloadText(text, filename, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  partyPresetDownloadBlob(blob, filename);
}

function partyPresetDownloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function exportPartyPresetJson() {
  const payload = partyPresetExportPayload();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  partyPresetDownloadText(
    JSON.stringify(payload, null, 2),
    `pokechamps-party-presets-${date}.json`,
    'application/json;charset=utf-8'
  );
  setPartyPresetStatus('JSON 내보내기 완료', 'success');
}

async function importPartyPresetJsonFile(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const data = parsed?.data?.parties ? parsed.data : parsed;
    if (!Array.isArray(data?.parties)) throw new Error('Invalid party preset JSON');
    partyPresetData = normalizePartyPresetData(data);
    savePartyPresetData();
    renderPartyPresetModal();
    setPartyPresetStatus('JSON 가져오기 완료', 'success');
  } catch {
    setPartyPresetStatus('JSON 형식을 확인해 주세요', 'error');
  }
}

async function partyPresetCopyOrDownload(text, filename) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    setPartyPresetStatus('Showdown 텍스트 복사 완료', 'success');
  } catch {
    partyPresetDownloadText(text, filename);
    setPartyPresetStatus('Showdown 텍스트 파일 저장 완료', 'success');
  }
}

function partyPresetMember(partyIndex, slotIndex) {
  return partyPresetData.parties?.[partyIndex]?.members?.[slotIndex] || blankPartyPresetMember();
}

function partyPresetMemberClone(member) {
  return normalizePartyPresetMember(member || blankPartyPresetMember());
}

function partyPresetFilledMembers(party) {
  return (party?.members || [])
    .map((member, slotIndex) => ({ member: partyPresetMemberClone(member), slotIndex }))
    .filter(entry => entry.member.pokemon && PokemonById[entry.member.pokemon]);
}

function partyPresetFilenamePart(text, fallback = 'party') {
  const safe = String(text || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 48);
  return safe || fallback;
}

function partyPresetExportTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function partyPresetImagePalette(theme = partyPresetExportTheme()) {
  if (theme === 'dark') {
    return {
      bg: '#0b111b',
      panel: '#121d2b',
      card: '#172333',
      cardSoft: '#101a27',
      spritePanel: '#05070b',
      box: '#0e1724',
      boxSoft: '#1b2a3d',
      border: '#314258',
      borderSoft: '#26364a',
      text: '#f2f7ff',
      dim: '#aebbd0',
      faint: '#7f8da3',
      accent: '#8b5cf6',
      accentSoft: '#251f3f',
      footer: '#8f9eb3',
    };
  }
  return {
    bg: '#f4f7fb',
    panel: '#ffffff',
    card: '#ffffff',
    cardSoft: '#f8fafc',
    spritePanel: '#0f172a',
    box: '#ffffff',
    boxSoft: '#eef3f8',
    border: '#d9e3ef',
    borderSoft: '#e8eef5',
    text: '#111827',
    dim: '#526173',
    faint: '#8a97a8',
    accent: '#7c3aed',
    accentSoft: '#efe8ff',
    footer: '#6b7280',
  };
}

function partyPresetRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function partyPresetFillRoundRect(ctx, x, y, width, height, radius, fill, stroke = '', lineWidth = 1) {
  partyPresetRoundRect(ctx, x, y, width, height, radius);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function partyPresetDrawShadowRoundRect(ctx, x, y, width, height, radius, fill, stroke = '', lineWidth = 1, shadow = {}) {
  ctx.save();
  ctx.shadowColor = shadow.color || 'rgba(15, 23, 42, 0.12)';
  ctx.shadowBlur = shadow.blur ?? 14;
  ctx.shadowOffsetY = shadow.offsetY ?? 8;
  partyPresetFillRoundRect(ctx, x, y, width, height, radius, fill, '', 0);
  ctx.restore();
  if (stroke) partyPresetFillRoundRect(ctx, x, y, width, height, radius, '', stroke, lineWidth);
}

function partyPresetDrawContainedImage(ctx, image, x, y, width, height) {
  if (!image) return;
  const naturalWidth = image.naturalWidth || image.width || width;
  const naturalHeight = image.naturalHeight || image.height || height;
  const scale = Math.min(width / naturalWidth, height / naturalHeight);
  const drawWidth = naturalWidth * scale;
  const drawHeight = naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function partyPresetCanvasFont(size, weight = 800, family = '"Noto Sans KR", "Malgun Gothic", sans-serif') {
  return `${weight} ${size}px ${family}`;
}

function partyPresetDrawText(ctx, text, x, y, maxWidth, {
  color = '#111827',
  size = 14,
  weight = 800,
  align = 'left',
  baseline = 'alphabetic',
} = {}) {
  const raw = String(text || '');
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = partyPresetCanvasFont(size, weight);
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  let output = raw;
  if (maxWidth && ctx.measureText(output).width > maxWidth) {
    while (output.length > 1 && ctx.measureText(`${output}...`).width > maxWidth) {
      output = output.slice(0, -1);
    }
    output = `${output}...`;
  }
  ctx.fillText(output, x, y);
  ctx.restore();
}

function partyPresetCanvasRow(ctx, label, value, x, y, width, palette) {
  const labelWidth = 58;
  const height = 26;
  partyPresetFillRoundRect(ctx, x, y, labelWidth, height, 7, palette.boxSoft, palette.borderSoft);
  partyPresetDrawText(ctx, label, x + labelWidth / 2, y + height / 2 + 1, labelWidth - 10, {
    color: palette.dim,
    size: 11,
    weight: 900,
    align: 'center',
    baseline: 'middle',
  });
  partyPresetFillRoundRect(ctx, x + labelWidth + 6, y, width - labelWidth - 6, height, 7, palette.box, palette.borderSoft);
  partyPresetDrawText(ctx, value, x + labelWidth + 16, y + height / 2 + 1, width - labelWidth - 26, {
    color: palette.text,
    size: 12,
    weight: 850,
    baseline: 'middle',
  });
}

function partyPresetMemberSummary(member) {
  const data = partyPresetMemberClone(member);
  const pokemon = PokemonById[data.pokemon];
  const ability = data.ability ? AbilityById[data.ability] : null;
  const item = data.item ? ItemById[data.item] : null;
  const nature = NATURE_BY_ID[data.nature];
  const evText = STATS.map(stat => `${PARTY_PRESET_STAT_LABEL[stat]}${data.evs?.[stat] || 0}`).join(' ');
  const moves = Array.from({ length: 4 }, (_, index) => {
    const move = MoveById[data.moves?.[index] || ''];
    return move
      ? { name: mvName(move), type: move.type || '', empty: false }
      : { name: PARTY_PRESET_LABELS.empty, type: '', empty: true };
  });
  return {
    pokemon,
    name: pokemon ? pkName(pokemon) : PARTY_PRESET_LABELS.emptySlot,
    ability: ability ? abName(ability) : PARTY_PRESET_LABELS.empty,
    item: item ? itName(item) : PARTY_PRESET_LABELS.empty,
    nature: nature ? calcNatureLabel(nature) : PARTY_PRESET_LABELS.empty,
    evText,
    moves,
  };
}

function partyPresetLoadImage(src) {
  return new Promise(resolve => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function partyPresetLoadSprite(pokemon) {
  const primary = await partyPresetLoadImage(pokemonSpriteUrl(pokemon));
  if (primary) return primary;
  return partyPresetLoadImage(pokemonSpriteFallbackUrl(pokemon));
}

function partyPresetDrawSpritePlaceholder(ctx, x, y, size, palette, options = {}) {
  const drawSurface = options.drawSurface !== false;
  const drawText = options.drawText !== false;
  if (drawSurface) partyPresetFillRoundRect(ctx, x, y, size, size, 10, palette.boxSoft, palette.border);
  if (drawText) {
    partyPresetDrawText(ctx, '-', x + size / 2, y + size / 2 + 1, size - 10, {
      color: palette.faint,
      size: 18,
      weight: 900,
      align: 'center',
      baseline: 'middle',
    });
  }
}

function partyPresetMovePalette(move, palette) {
  if (!move || move.empty) {
    return { bg: palette.box, fg: palette.faint, sub: palette.faint, border: palette.borderSoft };
  }
  const typePalette = PARTY_PRESET_MOVE_TYPE_COLORS[move.type] || { bg: palette.accent, fg: '#ffffff' };
  return {
    bg: typePalette.bg,
    fg: typePalette.fg,
    sub: typePalette.fg === '#ffffff' ? 'rgba(255,255,255,0.76)' : 'rgba(17,24,39,0.62)',
    border: 'rgba(255,255,255,0.42)',
  };
}

function partyPresetDrawImageField(ctx, label, value, x, y, width, palette, options = {}) {
  const labelWidth = 58;
  const height = 26;
  const drawSurface = options.drawSurface !== false;
  const drawText = options.drawText !== false;
  if (drawSurface) partyPresetFillRoundRect(ctx, x, y, width, height, 8, palette.box, palette.borderSoft, 1.2);
  if (drawText) {
    partyPresetDrawText(ctx, label, x + 13, y + height / 2 + 1, labelWidth - 8, {
      color: palette.dim,
      size: 13,
      weight: 900,
      baseline: 'middle',
    });
    partyPresetDrawText(ctx, value, x + labelWidth + 6, y + height / 2 + 1, width - labelWidth - 16, {
      color: palette.text,
      size: 14,
      weight: 900,
      baseline: 'middle',
    });
  }
}

function partyPresetDrawImageMove(ctx, move, x, y, width, height, palette, options = {}) {
  const colors = partyPresetMovePalette(move, palette);
  const drawSurface = options.drawSurface !== false;
  const drawText = options.drawText !== false;
  if (drawSurface) partyPresetFillRoundRect(ctx, x, y, width, height, 9, colors.bg, colors.border, 1);
  if (drawText) {
    partyPresetDrawText(ctx, move?.name || PARTY_PRESET_LABELS.empty, x + 12, y + height / 2 + 1, width - 54, {
      color: colors.fg,
      size: 12,
      weight: 900,
      baseline: 'middle',
    });
    const typeLabel = move?.type ? (TYPE_KO[move.type] || move.type) : '';
    if (typeLabel) {
      partyPresetDrawText(ctx, typeLabel, x + width - 12, y + height / 2 + 1, 42, {
        color: colors.sub,
        size: 10,
        weight: 900,
        align: 'right',
        baseline: 'middle',
      });
    }
  }
}

function partyPresetDrawMemberCard(ctx, entry, sprite, x, y, width, height, palette, options = {}) {
  const drawSurface = options.drawSurface !== false;
  const drawText = options.drawText !== false;
  if (drawSurface) partyPresetDrawShadowRoundRect(ctx, x, y, width, height, 20, palette.card, palette.border, 1.4);

  const spritePanelSize = 126;
  const spriteSize = 120;
  const spriteX = x + 16;
  const spriteY = y + 16;
  if (drawSurface) {
    partyPresetFillRoundRect(ctx, spriteX, spriteY, spritePanelSize, spritePanelSize, 18, palette.spritePanel, '');
    if (sprite) {
      partyPresetDrawContainedImage(ctx, sprite, spriteX + 3, spriteY + 3, spriteSize, spriteSize);
    } else {
      partyPresetDrawSpritePlaceholder(ctx, spriteX + 39, spriteY + 39, 48, palette, options);
    }
  } else if (!sprite && drawText) {
    partyPresetDrawSpritePlaceholder(ctx, spriteX + 39, spriteY + 39, 48, palette, options);
  }

  const infoX = x + 156;
  const infoWidth = width - 176;
  if (drawText) {
    partyPresetDrawText(ctx, entry.name, infoX, y + 39, infoWidth, {
      color: palette.text,
      size: 26,
      weight: 950,
    });
    partyPresetDrawText(ctx, entry.pokemon?.name || '', infoX + 1, y + 62, infoWidth, {
      color: palette.faint,
      size: 13,
      weight: 800,
    });
  }

  partyPresetDrawImageField(ctx, PARTY_PRESET_LABELS.ability, entry.ability, infoX, y + 82, infoWidth, palette, options);
  partyPresetDrawImageField(ctx, PARTY_PRESET_LABELS.item, entry.item, infoX, y + 114, infoWidth, palette, options);
  partyPresetDrawImageField(ctx, PARTY_PRESET_LABELS.nature, entry.nature, infoX, y + 146, infoWidth, palette, options);

  const fullRowX = x + 18;
  const fullRowWidth = width - 36;
  partyPresetDrawImageField(ctx, PARTY_PRESET_LABELS.evs, entry.evText, fullRowX, y + 184, fullRowWidth, palette, options);

  const moveX = fullRowX;
  const moveY = y + 224;
  const moveGapX = 14;
  const moveGapY = 8;
  const moveWidth = (width - 36 - moveGapX) / 2;
  const moveHeight = 30;
  entry.moves.forEach((move, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    partyPresetDrawImageMove(
      ctx,
      move,
      moveX + col * (moveWidth + moveGapX),
      moveY + row * (moveHeight + moveGapY),
      moveWidth,
      moveHeight,
      palette,
      options
    );
  });
}

function partyPresetDrawSummaryImage(ctx, partyName, members, sprites, palette, width, height, options = {}) {
  const drawSurface = options.drawSurface !== false;
  const drawText = options.drawText !== false;

  if (drawSurface) {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, width, height);
  }

  if (drawText) {
    partyPresetDrawText(ctx, 'POKEMON CHAMPIONS LAB', 38, 48, 520, {
      color: palette.faint,
      size: 15,
      weight: 800,
    });
    partyPresetDrawText(ctx, partyName, 38, 88, 860, {
      color: palette.text,
      size: 34,
      weight: 950,
    });
  }

  const gridX = 38;
  const gridY = 118;
  const gapX = 24;
  const gapY = 26;
  const cardWidth = (width - gridX * 2 - gapX * (PARTY_PRESET_IMAGE_CARD_COLUMNS - 1)) / PARTY_PRESET_IMAGE_CARD_COLUMNS;
  const cardHeight = (height - gridY - 56 - gapY * (PARTY_PRESET_IMAGE_CARD_ROWS - 1)) / PARTY_PRESET_IMAGE_CARD_ROWS;
  members.forEach((entry, index) => {
    const col = index % PARTY_PRESET_IMAGE_CARD_COLUMNS;
    const row = Math.floor(index / PARTY_PRESET_IMAGE_CARD_COLUMNS);
    partyPresetDrawMemberCard(
      ctx,
      entry,
      sprites[index],
      gridX + col * (cardWidth + gapX),
      gridY + row * (cardHeight + gapY),
      cardWidth,
      cardHeight,
      palette,
      options
    );
  });
}

async function exportPartyPresetSummaryImage(partyIndex) {
  const party = partyPresetData.parties?.[partyIndex];
  if (!party) return;

  const width = PARTY_PRESET_IMAGE_WIDTH;
  const height = PARTY_PRESET_IMAGE_HEIGHT;
  const outputScale = PARTY_PRESET_IMAGE_OUTPUT_SCALE;

  const canvas = document.createElement('canvas');
  canvas.width = width * outputScale;
  canvas.height = height * outputScale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(outputScale, outputScale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const theme = partyPresetExportTheme();
  const palette = partyPresetImagePalette(theme);
  const members = Array.from({ length: PARTY_PRESET_MAX_MEMBERS }, (_, slotIndex) => partyPresetMemberSummary(party.members?.[slotIndex]));
  const sprites = await Promise.all(members.map(entry => partyPresetLoadSprite(entry.pokemon)));
  const partyName = normalizePartyPresetName(party.name, partyIndex);

  partyPresetDrawSummaryImage(ctx, partyName, members, sprites, palette, width, height, {
    drawSurface: true,
    drawText: true,
  });

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Failed to create party image');
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  partyPresetDownloadBlob(blob, `pokechamps-${partyPresetFilenamePart(partyName)}-${date}.png`);
  setPartyPresetStatus(`${PARTY_PRESET_LABELS.imageExport} \uC644\uB8CC`, 'success');
}

function partyPresetMemberMoves(member) {
  return Array.from({ length: 4 }, (_, index) => {
    const moveId = member?.moves?.[index] || '';
    return MoveById[moveId] ? moveId : '';
  });
}

function partyPresetAttackingMoves(member) {
  return partyPresetMemberMoves(member).map(moveId => {
    const move = MoveById[moveId];
    return move && move.cat !== 'Status' ? moveId : null;
  });
}

function partyPresetApplyMemberToSideState(side, member) {
  const data = partyPresetMemberClone(member);
  const pokemon = PokemonById[data.pokemon];
  if (!side || !pokemon) return false;
  side.pokemonIdx = data.pokemon;
  side.ability = data.ability || defaultPokemonAbilityId(pokemon);
  side.item = data.item || '';
  side.nature = data.nature || 'hardy';
  side.evs = { ...side.evs, ...data.evs };
  side.types = defaultPokemonTypes(pokemon);
  side.teraType = side.types?.[0] || 'Normal';
  side.tera = false;
  side.moves = partyPresetMemberMoves(data);
  side.moveBpOverrides = [null, null, null, null];
  side.moveTypeOverrides = [null, null, null, null];
  setSideDamageBlockActive?.(side, false);
  return true;
}

function partyPresetApplyMemberToCalc(sideKey, member) {
  const side = state?.[sideKey];
  const pokemonId = member?.pokemon;
  if (!side || !PokemonById[pokemonId]) return false;
  const result = applyPokemonToCalcSide(sideKey, pokemonId, { forceDefaults: true, resetMoves: false });
  partyPresetApplyMemberToSideState(side, member);
  renderSide(sideKey);
  if (result?.resetAutoFields) syncFieldControls?.();
  triggerCalc?.();
  return true;
}

function partyPresetApplyMemberToFineTune(member) {
  if (!member?.pokemon || !PokemonById[member.pokemon]) return false;
  ftApplyPokemonToFineTune(member.pokemon);
  partyPresetApplyMemberToSideState(fineTuneState.my, member);
  fineTuneState.weatherAbilityActive = false;
  renderFineTuneAll();
  return true;
}

function partyPresetApplyMemberToRevCalc(member) {
  if (!member?.pokemon || !PokemonById[member.pokemon]) return false;
  rcApplyMyPokemonSelection(member.pokemon);
  partyPresetApplyMemberToSideState(revCalcState.my, member);
  revCalcState.myMoveSet = partyPresetMemberMoves(member);
  revCalcState.myMove = revCalcState.myMoveSet.includes(revCalcState.myMove) ? revCalcState.myMove : '';
  revCalcState.myMoveBp = '';
  renderRevCalcAll();
  return true;
}

function partyPresetApplyPartyToMatchup(partyIndex) {
  const party = partyPresetData.parties?.[partyIndex];
  if (!party) return false;
  Array.from({ length: PARTY_PRESET_MAX_MEMBERS }).forEach((_, slotIndex) => {
    const member = partyPresetMemberClone(party.members?.[slotIndex]);
    matchupSlots[slotIndex] = member.pokemon && PokemonById[member.pokemon] ? member.pokemon : null;
    matchupCoverageMoves[slotIndex] = matchupSlots[slotIndex]
      ? partyPresetAttackingMoves(member)
      : [null, null, null, null];
  });
  renderMatchupSlots();
  renderMatchupCoverageInputs();
  renderMatchupTable();
  return true;
}

function partyPresetApplyPickerMember(target, member) {
  if (target === 'calc:atk') return partyPresetApplyMemberToCalc('atk', member);
  if (target === 'calc:def') return partyPresetApplyMemberToCalc('def', member);
  if (target === 'finetune:my') return partyPresetApplyMemberToFineTune(member);
  if (target === 'revcalc:my') return partyPresetApplyMemberToRevCalc(member);
  return false;
}

function partyPresetDefaultAbility(pokemonId) {
  const pokemon = PokemonById[pokemonId];
  const first = Object.values(pokemon?.ab || {})[0];
  return first ? toId(first) : '';
}

function partyPresetDefaultItem(pokemonId) {
  return defaultPokemonItemId(PokemonById[pokemonId]);
}

function partyPresetLookupByText(collection, byId, text) {
  const key = toId(text);
  if (!key) return null;
  if (byId[key]) return byId[key];
  return collection.find(entry => (
    toId(entry?.id) === key ||
    toId(entry?.name) === key ||
    toId(entry?.koName) === key
  )) || null;
}

function partyPresetPokemonFromShowdownName(text) {
  let name = String(text || '').trim();
  name = name.replace(/\s+\((?:M|F)\)$/i, '').trim();
  const nicknameMatch = name.match(/\(([^()]+)\)\s*$/);
  if (nicknameMatch && !/^(?:M|F)$/i.test(nicknameMatch[1])) {
    name = nicknameMatch[1].trim();
  }
  return partyPresetLookupByText(POKEMON, PokemonById, name);
}

function partyPresetNatureFromText(text) {
  const key = toId(text);
  if (!key) return null;
  return NATURE_BY_ID[key] || NATURES.find(nature => (
    toId(nature?.id) === key ||
    toId(nature?.name) === key ||
    toId(nature?.ko) === key
  )) || null;
}

function partyPresetParseShowdownEvs(text) {
  const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  String(text || '').split('/').forEach(part => {
    const match = part.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) return;
    const value = Math.max(0, Math.min(32, parseInt(match[1], 10) || 0));
    const stat = PARTY_PRESET_SHOWDOWN_STAT_ALIAS[toId(match[2])];
    if (stat) evs[stat] = value;
  });
  return evs;
}

function partyPresetParseShowdownSet(block) {
  const lines = String(block || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return null;

  const member = blankPartyPresetMember();
  const firstLine = lines[0];
  const [pokemonText, itemText = ''] = firstLine.split(/\s+@\s+/, 2);
  const pokemon = partyPresetPokemonFromShowdownName(pokemonText);
  if (!pokemon) return null;

  member.pokemon = pokemon.id;
  member.ability = partyPresetDefaultAbility(pokemon.id);
  member.item = partyPresetDefaultItem(pokemon.id);

  const item = partyPresetLookupByText(ITEMS, ItemById, itemText);
  if (item) member.item = item.id;

  const moves = [];
  lines.slice(1).forEach(line => {
    const abilityMatch = line.match(/^Ability:\s*(.+)$/i);
    if (abilityMatch) {
      const ability = partyPresetLookupByText(ABILITIES, AbilityById, abilityMatch[1]);
      if (ability) member.ability = ability.id;
      return;
    }

    const evMatch = line.match(/^EVs:\s*(.+)$/i);
    if (evMatch) {
      member.evs = partyPresetParseShowdownEvs(evMatch[1]);
      return;
    }

    const natureMatch = line.match(/^(.+?)\s+Nature$/i);
    if (natureMatch) {
      const nature = partyPresetNatureFromText(natureMatch[1]);
      if (nature) member.nature = nature.id;
      return;
    }

    const moveMatch = line.match(/^-\s*(.+)$/);
    if (moveMatch && moves.length < 4) {
      const move = partyPresetLookupByText(MOVES, MoveById, moveMatch[1]);
      moves.push(move?.id || '');
    }
  });

  member.moves = Array.from({ length: 4 }, (_, index) => moves[index] || '');
  return normalizePartyPresetMember(member);
}

function partyPresetParseShowdownParty(text) {
  const blocks = String(text || '').split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
  return blocks
    .map(partyPresetParseShowdownSet)
    .filter(Boolean)
    .slice(0, PARTY_PRESET_MAX_MEMBERS);
}

function partyPresetNatureShowdownName(natureId) {
  const nature = NATURE_BY_ID[natureId];
  const raw = nature?.name || nature?.id || 'hardy';
  return String(raw).charAt(0).toUpperCase() + String(raw).slice(1);
}

function partyPresetExportShowdownSet(member) {
  const pokemon = PokemonById[member?.pokemon];
  if (!pokemon) return '';

  const item = member.item ? ItemById[member.item] : null;
  const ability = member.ability ? AbilityById[member.ability] : null;
  const lines = [`${pokemon.name}${item ? ` @ ${item.name}` : ''}`];
  if (ability) lines.push(`Ability: ${ability.name}`);

  const evParts = STATS
    .filter(stat => Number(member.evs?.[stat] || 0) > 0)
    .map(stat => `${member.evs[stat]} ${PARTY_PRESET_SHOWDOWN_STAT_LABEL[stat]}`);
  if (evParts.length) lines.push(`EVs: ${evParts.join(' / ')}`);

  lines.push(`${partyPresetNatureShowdownName(member.nature)} Nature`);
  (member.moves || []).slice(0, 4).forEach(moveId => {
    const move = MoveById[moveId];
    if (move) lines.push(`- ${move.name}`);
  });
  return lines.join('\n');
}

function partyPresetExportShowdownParty(partyIndex) {
  const party = partyPresetData.parties?.[partyIndex];
  if (!party) return '';
  return party.members
    .map(partyPresetExportShowdownSet)
    .filter(Boolean)
    .join('\n\n');
}

function importPartyPresetShowdownText(partyIndex, text) {
  const members = partyPresetParseShowdownParty(text);
  if (!members.length) {
    setPartyPresetStatus('Showdown 텍스트에서 포켓몬을 찾지 못했습니다', 'error');
    return false;
  }
  const party = partyPresetData.parties?.[partyIndex];
  if (!party) return false;
  party.members = Array.from({ length: PARTY_PRESET_MAX_MEMBERS }, (_, index) => (
    members[index] || blankPartyPresetMember()
  ));
  partyPresetData = normalizePartyPresetData(partyPresetData);
  savePartyPresetData();
  renderPartyPresetModal();
  setPartyPresetStatus(`파티 ${partyIndex + 1} Showdown 텍스트 가져오기 완료`, 'success');
  return true;
}

function partyPresetMovePool(pokemonId) {
  const pokemon = PokemonById[pokemonId];
  const pool = pokemon?.ls?.length ? pokemon.ls.map(id => MoveById[id]).filter(Boolean) : MOVES;
  return sortMovesForCalcSelect(pool);
}

function partyPresetSearch(query, ...terms) {
  const needle = calcSearchText(query).trim();
  if (!needle) return true;
  return calcMatches(needle, ...terms);
}

function partyPresetOptionHtml(id, label, selected = false, extra = '') {
  return `<div class="combobox-option party-preset-option${selected ? ' selected' : ''}" data-id="${escapeHTML(id)}" role="option" aria-selected="${selected ? 'true' : 'false'}"><b>${escapeHTML(label)}</b>${extra}</div>`;
}

function renderPartyPresetPokemonOption(pokemon, currentId) {
  const typeHtml = (pokemon.types || []).map(type => `<span class="type-pill matchup-type-pill t-${escapeHTML(type)}">${escapeHTML(TYPE_KO[type] || type)}</span>`).join('');
  return partyPresetOptionHtml(
    pokemon.id,
    pkName(pokemon),
    pokemon.id === currentId,
    `<small class="party-preset-option-types">${typeHtml}</small>`
  );
}

function renderPartyPresetMoveOption(move, currentId) {
  if (!move?.id) return partyPresetOptionHtml('', '없음', !currentId);
  return partyPresetOptionHtml(move.id, mvName(move), move.id === currentId);
}

function renderPartyPresetGenericOption(option, currentId) {
  const label = option.label || option.koName || option.name || option.id || '없음';
  return partyPresetOptionHtml(option.id || '', label, String(option.id || '') === String(currentId || ''));
}

function partyPresetOptions(type, member, query) {
  if (type === 'pokemon') {
    return sortPokemonForCalcSelect(POKEMON)
      .filter(pokemon => partyPresetSearch(query, pokemon.koName || pkName(pokemon)));
  }
  if (type === 'ability') {
    return calcAbilityOptionDataForPokemon(member.pokemon, member.ability, { includeEmpty: true })
      .filter(option => partyPresetSearch(query, option.id, option.label, option.sub));
  }
  if (type === 'item') {
    return calcItemOptionData({ includeEmpty: true })
      .filter(option => partyPresetSearch(query, option.id, option.label, option.sub));
  }
  if (type === 'nature') {
    return calcNatureOptionData()
      .filter(option => partyPresetSearch(query, option.id, option.label, option.sub));
  }
  if (type === 'move') {
    const empty = [{ id: '', label: '없음' }];
    return [...empty, ...partyPresetMovePool(member.pokemon)]
      .filter(option => partyPresetSearch(query, option.koName || option.label || mvName(option)));
  }
  return [];
}

function partyPresetCurrentLabel(type, member, moveIndex = null) {
  if (type === 'pokemon') return member.pokemon && PokemonById[member.pokemon] ? pkName(PokemonById[member.pokemon]) : '';
  if (type === 'ability') return member.ability && AbilityById[member.ability] ? abName(AbilityById[member.ability]) : '없음';
  if (type === 'item') return member.item && ItemById[member.item] ? itName(ItemById[member.item]) : '없음';
  if (type === 'nature') return calcNatureLabel(NATURE_BY_ID[member.nature]);
  if (type === 'move') {
    const id = member.moves?.[moveIndex] || '';
    return id && MoveById[id] ? mvName(MoveById[id]) : '';
  }
  return '';
}

function renderPartyPresetOptions(type, member, query, currentId) {
  const options = partyPresetOptions(type, member, query);
  if (!options.length) return '<div class="combobox-option empty" aria-disabled="true"><b>검색 결과 없음</b></div>';
  return options.map(option => {
    if (type === 'pokemon') return renderPartyPresetPokemonOption(option, currentId);
    if (type === 'move') return renderPartyPresetMoveOption(option, currentId);
    return renderPartyPresetGenericOption(option, currentId);
  }).join('');
}

function partyPresetComboboxHtml({ partyIndex, slotIndex, type, value, label = '', moveIndex = '' }) {
  const safeMoveIndex = moveIndex === '' ? '' : ` data-move-index="${moveIndex}"`;
  return `
    <div class="combobox party-preset-combobox" data-party-preset-combobox="${type}">
      <input type="text" class="cb-input party-preset-input" value="${escapeHTML(label)}"
        data-party-index="${partyIndex}" data-slot-index="${slotIndex}" data-preset-field="${type}"${safeMoveIndex}
        data-value="${escapeHTML(value || '')}" placeholder="${type === 'pokemon' ? '포켓몬 선택' : '선택'}" autocomplete="off" aria-expanded="false">
      <div class="combobox-options" role="listbox"></div>
    </div>
  `;
}

function partyPresetNatureMark(stat, natureId) {
  const nature = NATURE_BY_ID?.[natureId];
  if (nature?.up === stat) return '<span class="party-preset-nature-mark up" aria-label="상승">&#9650;</span>';
  if (nature?.down === stat) return '<span class="party-preset-nature-mark down" aria-label="하락">&#9660;</span>';
  return '<span class="party-preset-nature-mark empty" aria-hidden="true"></span>';
}

function renderPartyPresetSlot(member, partyIndex, slotIndex) {
  const pokemon = member.pokemon ? PokemonById[member.pokemon] : null;
  const evTotal = STATS.reduce((sum, stat) => sum + (member.evs?.[stat] || 0), 0);
  const slotKey = partyPresetSlotCollapseKey(partyIndex, slotIndex);
  const isCollapsed = pokemon && !partyPresetExpandedSlots.has(slotKey);
  return `
    <div class="party-preset-slot ui-control-frame ui-subframe ${pokemon ? 'filled' : ''}${isCollapsed ? ' collapsed' : ''}" data-party-index="${partyIndex}" data-slot-index="${slotIndex}">
      <div class="party-preset-slot-head">
        <span class="party-preset-slot-label">${slotIndex + 1}</span>
        ${pokemonSpriteSlot(pokemon, { className: 'party-preset-slot-sprite' })}
        ${partyPresetComboboxHtml({ partyIndex, slotIndex, type: 'pokemon', value: member.pokemon, label: partyPresetCurrentLabel('pokemon', member) })}
        <button class="party-preset-clear" type="button" data-party-index="${partyIndex}" data-slot-index="${slotIndex}" aria-label="비우기" title="비우기" ${pokemon ? '' : 'disabled'}>&times;</button>
      </div>
      ${pokemon ? `
        <div class="party-preset-detail">
          <div class="party-preset-divider" aria-hidden="true"></div>
          <div class="party-preset-detail-row party-preset-detail-row-3">
            <label><span>특성</span>${partyPresetComboboxHtml({ partyIndex, slotIndex, type: 'ability', value: member.ability, label: partyPresetCurrentLabel('ability', member) })}</label>
            <label><span>성격</span>${partyPresetComboboxHtml({ partyIndex, slotIndex, type: 'nature', value: member.nature, label: partyPresetCurrentLabel('nature', member) })}</label>
            <label><span>도구</span>${partyPresetComboboxHtml({ partyIndex, slotIndex, type: 'item', value: member.item, label: partyPresetCurrentLabel('item', member) })}</label>
          </div>
          <div class="party-preset-divider" aria-hidden="true"></div>
          <div class="party-preset-ev-row">
            <span class="party-preset-ev-total">
              <span>총합</span>
              <span><b>${evTotal}</b>/66</span>
            </span>
            ${STATS.map(stat => `
              <label class="party-preset-ev-cell">
                <span class="party-preset-ev-head">
                  <span>${PARTY_PRESET_STAT_LABEL[stat]}</span>
                  ${partyPresetNatureMark(stat, member.nature)}
                </span>
                <input type="text" class="party-preset-ev-input" data-party-index="${partyIndex}" data-slot-index="${slotIndex}" data-preset-ev="${stat}" value="${member.evs?.[stat] || 0}" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
              </label>
            `).join('')}
          </div>
          <div class="party-preset-divider" aria-hidden="true"></div>
          <div class="party-preset-move-row">
            ${[0, 1, 2, 3].map(moveIndex => `
              <label><span>기술 ${moveIndex + 1}</span>${partyPresetComboboxHtml({ partyIndex, slotIndex, type: 'move', value: member.moves?.[moveIndex] || '', label: partyPresetCurrentLabel('move', member, moveIndex), moveIndex })}</label>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderPartyPresetModal() {
  ensurePartyPresetModal();
  const body = document.getElementById('partyPresetBody');
  if (!body) return;
  body.innerHTML = partyPresetData.parties.map((party, partyIndex) => {
    const isCollapsed = partyPresetCollapsedParties.has(partyIndex);
    const filledCount = partyPresetFilledMembers(party).length;
    const partyName = normalizePartyPresetName(party.name, partyIndex);
    return `
    <section class="party-preset-party ui-control-frame ui-subframe ${isCollapsed ? 'collapsed' : ''}" data-party-index="${partyIndex}">
      <div class="party-preset-party-head">
        <div class="party-preset-party-title">
          <input type="text" class="party-preset-name-input" data-party-name-index="${partyIndex}" value="${escapeHTML(partyName)}" maxlength="${PARTY_PRESET_MAX_NAME_LENGTH}" aria-label="party ${partyIndex + 1} name">
          <span class="party-preset-party-count">${filledCount}/6</span>
        </div>
        <div class="party-preset-party-actions">
          <button type="button" class="party-preset-party-action" data-party-showdown-import="${partyIndex}">텍스트 가져오기</button>
          <button type="button" class="party-preset-party-action" data-party-showdown-export="${partyIndex}">텍스트 내보내기</button>
          <button type="button" class="party-preset-party-action" data-party-image-export="${partyIndex}">${PARTY_PRESET_LABELS.imageExport}</button>
        </div>
      </div>
      <div class="party-preset-slot-grid">
        ${party.members.map((member, slotIndex) => renderPartyPresetSlot(member, partyIndex, slotIndex)).join('')}
      </div>
    </section>
    `;
  }).join('');
  wirePartyPresetInputs();
}

function ensurePartyPresetModal() {
  if (document.getElementById('partyPresetModal')) return;
  const modal = document.createElement('div');
  modal.id = 'partyPresetModal';
  modal.className = 'party-preset-modal-backdrop';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="party-preset-modal ui-frame" role="dialog" aria-modal="true" aria-labelledby="partyPresetTitle" aria-describedby="partyPresetBackupNote">
      <div class="party-preset-modal-head ui-frame-head">
        <div>
          <div class="party-preset-eyebrow">PARTY PRESET</div>
          <h2 id="partyPresetTitle">파티 프리셋</h2>
        </div>
        <div class="party-preset-modal-actions">
          <span class="party-preset-status" id="partyPresetStatus" aria-live="polite"></span>
          <button type="button" class="party-preset-action" id="partyPresetImport">JSON 가져오기</button>
          <button type="button" class="party-preset-action" id="partyPresetExport">JSON 내보내기</button>
          <button type="button" class="party-preset-close" id="partyPresetClose">닫기</button>
          <input type="file" id="partyPresetImportFile" accept=".json,application/json" hidden>
        </div>
      </div>
      <div class="party-preset-backup-note" id="partyPresetBackupNote" role="note">
        프리셋은 현재 브라우저에 저장됩니다. 기기 변경이나 브라우저 초기화 전에 JSON 내보내기로 백업하세요.
      </div>
      <div class="party-preset-modal-body ui-frame-body ui-subframe-stack" id="partyPresetBody"></div>
      <div class="party-preset-text-dialog" id="partyPresetTextDialog" hidden>
        <div class="party-preset-text-card ui-frame">
          <div class="party-preset-text-head">
            <h3 id="partyPresetTextTitle">Showdown 텍스트</h3>
            <button type="button" class="party-preset-close" id="partyPresetTextClose">닫기</button>
          </div>
          <textarea id="partyPresetTextArea" class="party-preset-textarea" spellcheck="false"></textarea>
          <div class="party-preset-text-actions">
            <button type="button" class="party-preset-action" id="partyPresetTextApply">가져오기 적용</button>
            <button type="button" class="party-preset-action" id="partyPresetTextCopy">복사</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function openPartyPresetModal() {
  renderPartyPresetModal();
  const modal = document.getElementById('partyPresetModal');
  if (!modal) return;
  setPartyPresetStatus('');
  modal.hidden = false;
  modal.scrollTop = 0;
  document.getElementById('partyPresetBody')?.scrollTo({ top: 0, left: 0 });
  document.body.classList.add('party-preset-open');
}

function closePartyPresetModal() {
  const modal = document.getElementById('partyPresetModal');
  if (!modal) return;
  closePartyPresetTextDialog();
  modal.hidden = true;
  document.body.classList.remove('party-preset-open');
}

function ensurePartyPresetPickerModal() {
  if (document.getElementById('partyPresetPickerModal')) return;
  const modal = document.createElement('div');
  modal.id = 'partyPresetPickerModal';
  modal.className = 'party-preset-picker-backdrop';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="party-preset-picker ui-frame" role="dialog" aria-modal="true" aria-labelledby="partyPresetPickerTitle">
      <div class="party-preset-picker-head ui-frame-head">
        <div>
          <div class="party-preset-eyebrow">PARTY LOAD</div>
          <h2 id="partyPresetPickerTitle">불러오기</h2>
        </div>
        <button type="button" class="party-preset-close" id="partyPresetPickerClose">닫기</button>
      </div>
      <div class="party-preset-picker-body ui-frame-body ui-subframe-stack" id="partyPresetPickerBody"></div>
    </div>
  `;
  document.body.appendChild(modal);
}

function partyPresetPickerMode(target) {
  return target === 'matchup' ? 'party' : 'member';
}

function renderPartyPresetPicker() {
  ensurePartyPresetPickerModal();
  const body = document.getElementById('partyPresetPickerBody');
  const title = document.getElementById('partyPresetPickerTitle');
  if (!body || !title) return;
  const mode = partyPresetPickerMode(partyPresetPickerTarget);
  title.textContent = mode === 'party' ? '파티 불러오기' : '포켓몬 불러오기';

  if (mode === 'party') {
    body.innerHTML = `
      <section class="party-preset-picker-section party-preset-picker-party-section ui-control-frame ui-subframe">
        <div class="party-preset-picker-party-grid">
          ${partyPresetData.parties.map((party, partyIndex) => {
            const members = partyPresetFilledMembers(party);
            const labels = members.map(entry => pkName(PokemonById[entry.member.pokemon])).join(' · ');
            return `
              <button type="button" class="party-preset-picker-party ${members.length ? '' : 'empty'}" data-party-picker-party="${partyIndex}" ${members.length ? '' : 'disabled'}>
                <span class="party-preset-picker-sprite-row" aria-hidden="true">
                  ${members.map(entry => pokemonSpriteSlot(PokemonById[entry.member.pokemon], { size: 'sm', className: 'party-preset-picker-sprite' })).join('')}
                </span>
                <b>${escapeHTML(normalizePartyPresetName(party.name, partyIndex))}</b>
                <span>${members.length ? escapeHTML(labels) : '저장된 포켓몬 없음'}</span>
              </button>
            `;
          }).join('')}
        </div>
      </section>
    `;
    return;
  }

  body.innerHTML = partyPresetData.parties.map((party, partyIndex) => {
    const members = partyPresetFilledMembers(party);
    return `
      <section class="party-preset-picker-section ui-control-frame ui-subframe">
        <div class="party-preset-picker-section-head">${escapeHTML(normalizePartyPresetName(party.name, partyIndex))}</div>
        <div class="party-preset-picker-member-grid">
          ${members.length ? members.map(({ member, slotIndex }) => {
            const pokemon = PokemonById[member.pokemon];
            return `
              <button type="button" class="party-preset-picker-member" data-party-picker-party="${partyIndex}" data-party-picker-slot="${slotIndex}">
                ${pokemonSpriteSlot(pokemon, { className: 'party-preset-picker-member-sprite' })}
                <span>슬롯 ${slotIndex + 1}</span>
                <b>${escapeHTML(pkName(pokemon))}</b>
              </button>
            `;
          }).join('') : '<div class="party-preset-picker-empty">저장된 포켓몬 없음</div>'}
        </div>
      </section>
    `;
  }).join('');
}

function openPartyPresetPicker(target) {
  ensurePartyPresetPickerModal();
  partyPresetPickerTarget = target || '';
  renderPartyPresetPicker();
  const modal = document.getElementById('partyPresetPickerModal');
  if (!modal) return;
  modal.hidden = false;
  modal.scrollTop = 0;
  document.getElementById('partyPresetPickerBody')?.scrollTo({ top: 0, left: 0 });
  document.body.classList.add('party-preset-open');
}

function closePartyPresetPicker() {
  const modal = document.getElementById('partyPresetPickerModal');
  if (modal) modal.hidden = true;
  partyPresetPickerTarget = '';
  if (document.getElementById('partyPresetModal')?.hidden !== false) {
    document.body.classList.remove('party-preset-open');
  }
}

function applyPartyPresetPickerSelection(partyIndex, slotIndex = null) {
  let applied = false;
  if (partyPresetPickerMode(partyPresetPickerTarget) === 'party') {
    applied = partyPresetApplyPartyToMatchup(partyIndex);
  } else {
    applied = partyPresetApplyPickerMember(
      partyPresetPickerTarget,
      partyPresetMemberClone(partyPresetData.parties?.[partyIndex]?.members?.[slotIndex])
    );
  }
  if (applied) closePartyPresetPicker();
}

function openPartyPresetTextDialog(partyIndex, mode) {
  const dialog = document.getElementById('partyPresetTextDialog');
  const title = document.getElementById('partyPresetTextTitle');
  const area = document.getElementById('partyPresetTextArea');
  const applyButton = document.getElementById('partyPresetTextApply');
  const copyButton = document.getElementById('partyPresetTextCopy');
  if (!dialog || !title || !area) return;

  partyPresetTextState = { partyIndex, mode };
  const partyName = partyPresetData.parties?.[partyIndex]?.name || `파티 ${partyIndex + 1}`;
  const isExport = mode === 'export';
  title.textContent = `${partyName} Showdown 텍스트 ${isExport ? '내보내기' : '가져오기'}`;
  area.value = isExport ? partyPresetExportShowdownParty(partyIndex) : '';
  area.placeholder = 'Showdown 텍스트를 붙여넣어 주세요';
  area.readOnly = isExport;
  if (applyButton) applyButton.hidden = isExport;
  if (copyButton) copyButton.hidden = !isExport;
  dialog.hidden = false;
  requestAnimationFrame(() => {
    area.focus();
    if (isExport) area.select();
  });
}

function closePartyPresetTextDialog() {
  const dialog = document.getElementById('partyPresetTextDialog');
  if (dialog) dialog.hidden = true;
}

function applyPartyPresetTextImport() {
  const area = document.getElementById('partyPresetTextArea');
  if (!area) return;
  if (importPartyPresetShowdownText(partyPresetTextState.partyIndex, area.value)) {
    closePartyPresetTextDialog();
  }
}

function copyPartyPresetTextExport() {
  const area = document.getElementById('partyPresetTextArea');
  if (!area) return;
  const partyIndex = partyPresetTextState.partyIndex;
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  partyPresetCopyOrDownload(area.value, `pokechamps-party-${partyIndex + 1}-${date}.txt`);
}

function updatePartyPresetName(input, { normalize = false } = {}) {
  const partyIndex = Number(input.dataset.partyNameIndex);
  const party = partyPresetData.parties?.[partyIndex];
  if (!party) return;
  const nextName = normalize
    ? normalizePartyPresetName(input.value, partyIndex)
    : String(input.value || '').slice(0, PARTY_PRESET_MAX_NAME_LENGTH);
  party.name = nextName;
  input.value = nextName;
  savePartyPresetData();
}

function updatePartyPresetPokemon(partyIndex, slotIndex, pokemonId) {
  const member = partyPresetMember(partyIndex, slotIndex);
  if (!pokemonId) {
    partyPresetData.parties[partyIndex].members[slotIndex] = blankPartyPresetMember();
    partyPresetExpandedSlots.delete(partyPresetSlotCollapseKey(partyIndex, slotIndex));
    return;
  }
  if (member.pokemon !== pokemonId) {
    partyPresetData.parties[partyIndex].members[slotIndex] = {
      ...blankPartyPresetMember(),
      pokemon: pokemonId,
      ability: partyPresetDefaultAbility(pokemonId),
      item: partyPresetDefaultItem(pokemonId),
    };
  }
  partyPresetCollapsedParties.delete(partyIndex);
  partyPresetExpandedSlots.add(partyPresetSlotCollapseKey(partyIndex, slotIndex));
}

function updatePartyPresetField(partyIndex, slotIndex, field, value, moveIndex = null) {
  const member = partyPresetMember(partyIndex, slotIndex);
  if (field === 'pokemon') {
    updatePartyPresetPokemon(partyIndex, slotIndex, value);
  } else if (field === 'move') {
    member.moves[moveIndex] = value || '';
  } else if (field === 'ability') {
    member.ability = value || '';
  } else if (field === 'item') {
    member.item = value || '';
  } else if (field === 'nature') {
    member.nature = value || 'hardy';
  }
  savePartyPresetData();
}

function updatePartyPresetEv(input) {
  const partyIndex = Number(input.dataset.partyIndex);
  const slotIndex = Number(input.dataset.slotIndex);
  const stat = input.dataset.presetEv;
  const member = partyPresetMember(partyIndex, slotIndex);
  const requested = Math.max(0, Math.min(32, parseInt(input.value, 10) || 0));
  const otherTotal = STATS.reduce((sum, key) => sum + (key === stat ? 0 : (member.evs?.[key] || 0)), 0);
  member.evs[stat] = Math.min(requested, Math.max(0, 66 - otherTotal));
  savePartyPresetData();
  renderPartyPresetModal();
}

function closePartyPresetComboboxes(exceptInput = null) {
  document.querySelectorAll('#partyPresetModal .combobox-options.open').forEach(options => {
    const input = options.closest('.combobox')?.querySelector('.party-preset-input');
    if (input && input === exceptInput) return;
    options.classList.remove('open');
    input?.setAttribute('aria-expanded', 'false');
  });
}

function wirePartyPresetCombobox(input) {
  const wrapper = input.closest('.combobox');
  const optsEl = wrapper?.querySelector('.combobox-options');
  if (!wrapper || !optsEl) return;
  const partyIndex = Number(input.dataset.partyIndex);
  const slotIndex = Number(input.dataset.slotIndex);
  const type = input.dataset.presetField;
  const moveIndex = input.dataset.moveIndex === undefined ? null : Number(input.dataset.moveIndex);
  const member = partyPresetMember(partyIndex, slotIndex);
  const currentId = () => type === 'move' ? (member.moves?.[moveIndex] || '') : (member[type] || '');
  let pointerSelected = false;

  const showOptions = query => {
    closePartyPresetComboboxes(input);
    optsEl.innerHTML = renderPartyPresetOptions(type, member, query, currentId());
    optsEl.classList.add('open');
    input.setAttribute('aria-expanded', 'true');
  };
  const selectOption = option => {
    const id = option?.dataset?.id || '';
    optsEl.classList.remove('open');
    input.setAttribute('aria-expanded', 'false');
    updatePartyPresetField(partyIndex, slotIndex, type, id, moveIndex);
    renderPartyPresetModal();
  };
  const restoreInput = () => {
    const fresh = partyPresetMember(partyIndex, slotIndex);
    input.value = partyPresetCurrentLabel(type, fresh, moveIndex);
  };
  const clearOptionalInput = () => {
    if (!['move', 'ability', 'item'].includes(type)) return false;
    updatePartyPresetField(partyIndex, slotIndex, type, '', moveIndex);
    renderPartyPresetModal();
    return true;
  };
  const handleInvalidInput = () => {
    if (!clearOptionalInput()) restoreInput();
  };

  const combo = wireSharedComboboxKeyboard(input, optsEl, {
    showOptions,
    onSelect: selectOption,
    getQuery: () => input.value || '',
    onInvalidInput: handleInvalidInput,
  });
  input.addEventListener('focus', () => {
    combo?.open('');
    requestAnimationFrame(() => input.select?.());
  });
  input.addEventListener('input', () => combo?.open(input.value || '', { activateFirst: true }));
  input.addEventListener('blur', () => setTimeout(() => {
    if (pointerSelected) {
      pointerSelected = false;
      return;
    }
    if (!String(input.value || '').trim()) {
      if (clearOptionalInput()) return;
      combo?.close();
      restoreInput();
      return;
    }
    combo?.commitTyped();
  }, 180));
  optsEl.addEventListener('mousedown', event => {
    const option = event.target.closest('.combobox-option:not(.empty)');
    if (!option) return;
    event.preventDefault();
    pointerSelected = true;
    combo?.select(option);
  });
}

function wirePartyPresetInputs() {
  const modal = document.getElementById('partyPresetModal');
  if (!modal) return;
  modal.querySelectorAll('.party-preset-name-input').forEach(input => {
    input.addEventListener('input', () => updatePartyPresetName(input));
    input.addEventListener('blur', () => updatePartyPresetName(input, { normalize: true }));
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') input.blur();
      event.stopPropagation();
    });
  });
  modal.querySelectorAll('.party-preset-input').forEach(wirePartyPresetCombobox);
  modal.querySelectorAll('.party-preset-ev-input').forEach(input => {
    input.addEventListener('change', () => updatePartyPresetEv(input));
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') input.blur();
    });
  });
  modal.querySelectorAll('.party-preset-clear').forEach(button => {
    button.addEventListener('click', () => {
      const partyIndex = Number(button.dataset.partyIndex);
      const slotIndex = Number(button.dataset.slotIndex);
      partyPresetData.parties[partyIndex].members[slotIndex] = blankPartyPresetMember();
      partyPresetExpandedSlots.delete(partyPresetSlotCollapseKey(partyIndex, slotIndex));
      savePartyPresetData();
      renderPartyPresetModal();
    });
  });
  modal.querySelectorAll('[data-party-showdown-import]').forEach(button => {
    button.addEventListener('click', () => {
      openPartyPresetTextDialog(Number(button.dataset.partyShowdownImport), 'import');
    });
  });
  modal.querySelectorAll('[data-party-showdown-export]').forEach(button => {
    button.addEventListener('click', () => {
      openPartyPresetTextDialog(Number(button.dataset.partyShowdownExport), 'export');
    });
  });
  modal.querySelectorAll('[data-party-image-export]').forEach(button => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await exportPartyPresetSummaryImage(Number(button.dataset.partyImageExport));
      } catch {
        setPartyPresetStatus(`${PARTY_PRESET_LABELS.imageExport} \uC2E4\uD328`, 'error');
      } finally {
        button.disabled = false;
      }
    });
  });
}

function initPartyPresets() {
  if (partyPresetModalReady) return;
  partyPresetModalReady = true;
  ensurePartyPresetModal();
  ensurePartyPresetPickerModal();
  document.getElementById('partyPresetOpen')?.addEventListener('click', openPartyPresetModal);
  document.getElementById('partyPresetClose')?.addEventListener('click', closePartyPresetModal);
  document.getElementById('partyPresetPickerClose')?.addEventListener('click', closePartyPresetPicker);
  document.getElementById('partyPresetExport')?.addEventListener('click', exportPartyPresetJson);
  document.getElementById('partyPresetImport')?.addEventListener('click', () => {
    document.getElementById('partyPresetImportFile')?.click();
  });
  document.getElementById('partyPresetImportFile')?.addEventListener('change', event => {
    const input = event.currentTarget;
    importPartyPresetJsonFile(input.files?.[0]);
    input.value = '';
  });
  document.getElementById('partyPresetTextClose')?.addEventListener('click', closePartyPresetTextDialog);
  document.getElementById('partyPresetTextApply')?.addEventListener('click', applyPartyPresetTextImport);
  document.getElementById('partyPresetTextCopy')?.addEventListener('click', copyPartyPresetTextExport);
  document.getElementById('partyPresetModal')?.addEventListener('mousedown', event => {
    if (event.target?.id === 'partyPresetModal') closePartyPresetModal();
  });
  document.getElementById('partyPresetModal')?.addEventListener('click', event => {
    if (event.target.closest('button, input, textarea, select, .combobox, .combobox-options')) return;
    const slotHead = event.target.closest('.party-preset-slot-head');
    if (slotHead) {
      const slot = slotHead.closest('.party-preset-slot');
      const partyIndex = Number(slot?.dataset.partyIndex);
      const slotIndex = Number(slot?.dataset.slotIndex);
      const member = partyPresetMember(partyIndex, slotIndex);
      if (!member?.pokemon || !PokemonById[member.pokemon]) return;
      const key = partyPresetSlotCollapseKey(partyIndex, slotIndex);
      if (partyPresetExpandedSlots.has(key)) partyPresetExpandedSlots.delete(key);
      else partyPresetExpandedSlots.add(key);
      renderPartyPresetModal();
      return;
    }
    const partyHead = event.target.closest('.party-preset-party-head');
    if (partyHead) {
      const partyIndex = Number(partyHead.closest('.party-preset-party')?.dataset.partyIndex);
      if (!Number.isFinite(partyIndex)) return;
      if (partyPresetCollapsedParties.has(partyIndex)) partyPresetCollapsedParties.delete(partyIndex);
      else partyPresetCollapsedParties.add(partyIndex);
      renderPartyPresetModal();
    }
  });
  document.getElementById('partyPresetPickerModal')?.addEventListener('mousedown', event => {
    if (event.target?.id === 'partyPresetPickerModal') closePartyPresetPicker();
  });
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-party-import-target]');
    if (trigger) {
      event.preventDefault();
      openPartyPresetPicker(trigger.dataset.partyImportTarget);
      return;
    }
    const partyButton = event.target.closest('[data-party-picker-party]');
    if (partyButton && document.getElementById('partyPresetPickerModal')?.contains(partyButton)) {
      event.preventDefault();
      const partyIndex = Number(partyButton.dataset.partyPickerParty);
      const slotIndex = partyButton.dataset.partyPickerSlot === undefined ? null : Number(partyButton.dataset.partyPickerSlot);
      applyPartyPresetPickerSelection(partyIndex, slotIndex);
    }
  });
  window.addEventListener('keydown', event => {
    const modal = document.getElementById('partyPresetModal');
    const picker = document.getElementById('partyPresetPickerModal');
    if (event.key === 'Escape' && modal && !modal.hidden) closePartyPresetModal();
    if (event.key === 'Escape' && picker && !picker.hidden) closePartyPresetPicker();
  });
}
