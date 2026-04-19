export const fateKnotsCombatConfigManifest = {
  "version": 1,
  "startingEnergy": 3,
  "startingStatus": [],
  "enemyActions": [
    {
      "id": "lash",
      "label": "Lash",
      "power": 4
    },
    {
      "id": "pierce",
      "label": "Pierce",
      "power": 5
    },
    {
      "id": "shriek",
      "label": "Shriek",
      "power": 3,
      "stun": true
    }
  ],
  "encounters": [
    {
      "id": "well-entity",
      "label": "Well-Dwelling Entity",
      "assetId": "well_dwelling_entity",
      "stats": {
        "maxHp": 36,
        "attack": 5,
        "defense": 2,
        "speed": 3,
        "luck": 1
      },
      "actionSequence": [
        "lash",
        "pierce",
        "shriek"
      ],
      "introLog": "The knot below the stones tears open and a pale thing climbs into the square."
    }
  ]
};
export default fateKnotsCombatConfigManifest;
