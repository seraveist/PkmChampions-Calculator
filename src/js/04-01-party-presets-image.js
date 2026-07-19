/* Party presets: image export. */
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
