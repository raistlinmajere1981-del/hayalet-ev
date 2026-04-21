export const fateKnotsCombatCardsManifest = {
  "version": 1,
  "cards": [
    {
      "id": "strike",
      "label": "Strike",
      "iconAssetId": "target_marker",
      "type": "attack",
      "power": 4,
      "cost": 1,
      "description": "Reliable weapon attack."
    },
    {
      "id": "quick-strike",
      "label": "Quick Strike",
      "iconAssetId": "turn_badge",
      "type": "attack",
      "power": 3,
      "cost": 1,
      "speedBonus": 2,
      "description": "Lighter hit that keeps initiative moving."
    },
    {
      "id": "heavy-blow",
      "label": "Heavy Blow",
      "iconAssetId": "dice_badge",
      "type": "attack",
      "power": 6,
      "cost": 2,
      "description": "Slow but crushing damage."
    },
    {
      "id": "risk-strike",
      "label": "Risk Strike",
      "iconAssetId": "damage_flash",
      "type": "attack",
      "power": 7,
      "cost": 2,
      "selfDamage": 1,
      "description": "High damage with a painful opening."
    },
    {
      "id": "guard",
      "label": "Guard",
      "iconAssetId": "shield",
      "type": "defend",
      "guard": 4,
      "cost": 1,
      "description": "Reduce the next incoming hit."
    },
    {
      "id": "dodge",
      "label": "Dodge",
      "iconAssetId": "turn_indicator",
      "type": "defend",
      "evasion": 1,
      "cost": 1,
      "description": "Avoid the next blow entirely if luck holds."
    },
    {
      "id": "counter",
      "label": "Counter",
      "iconAssetId": "target_ring",
      "type": "defend",
      "counter": 3,
      "cost": 1,
      "description": "Store a retaliatory strike."
    },
    {
      "id": "focus",
      "label": "Focus",
      "iconAssetId": "focus",
      "type": "utility",
      "focus": 2,
      "cost": 1,
      "description": "Sharpen the next action."
    },
    {
      "id": "position",
      "label": "Position",
      "iconAssetId": "turn_order_marker",
      "type": "utility",
      "guard": 1,
      "speedBonus": 1,
      "cost": 1,
      "description": "Shift footing for defense and tempo."
    },
    {
      "id": "recover",
      "label": "Recover",
      "iconAssetId": "mana_bar",
      "type": "utility",
      "heal": 4,
      "cost": 1,
      "description": "Bind wounds and steady breath."
    },
    {
      "id": "poison",
      "label": "Poison",
      "iconAssetId": "poison",
      "type": "attack",
      "power": 2,
      "cost": 1,
      "poison": 2,
      "description": "Apply lingering damage."
    },
    {
      "id": "stun",
      "label": "Stun",
      "iconAssetId": "stun",
      "type": "attack",
      "power": 2,
      "cost": 2,
      "stun": true,
      "description": "Briefly break the target's rhythm."
    }
  ]
};
export default fateKnotsCombatCardsManifest;
