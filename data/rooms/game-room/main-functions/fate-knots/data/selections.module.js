export const fateKnotsSelectionsManifest = {
  "version": 1,
  "avatars": [
    {
      "id": "warrior_avatar",
      "label": "Stoneguard",
      "assetId": "warrior_avatar",
      "summary": "Frontline defender"
    },
    {
      "id": "ranger_avatar",
      "label": "Trailseer",
      "assetId": "ranger_avatar",
      "summary": "Fast skirmisher"
    },
    {
      "id": "mage_avatar",
      "label": "Ashbinder",
      "assetId": "mage_avatar",
      "summary": "Arcane pressure"
    },
    {
      "id": "healer_avatar",
      "label": "Lantern Saint",
      "assetId": "healer_avatar",
      "summary": "Recovery and warding"
    }
  ],
  "classes": [
    {
      "id": "warrior",
      "label": "Warden",
      "assetId": "warrior",
      "stats": {
        "maxHp": 22,
        "attack": 5,
        "defense": 4,
        "speed": 2,
        "luck": 1,
        "energy": 3
      },
      "startingDeck": [
        "strike",
        "guard",
        "heavy-blow",
        "counter"
      ]
    },
    {
      "id": "ranger",
      "label": "Pathfinder",
      "assetId": "ranger",
      "stats": {
        "maxHp": 18,
        "attack": 4,
        "defense": 2,
        "speed": 5,
        "luck": 3,
        "energy": 4
      },
      "startingDeck": [
        "quick-strike",
        "position",
        "dodge",
        "risk-strike"
      ]
    },
    {
      "id": "mage",
      "label": "Hexwright",
      "assetId": "mage",
      "stats": {
        "maxHp": 16,
        "attack": 6,
        "defense": 1,
        "speed": 3,
        "luck": 2,
        "energy": 5
      },
      "startingDeck": [
        "focus",
        "poison",
        "stun",
        "strike"
      ]
    },
    {
      "id": "healer",
      "label": "Beacon",
      "assetId": "healer",
      "stats": {
        "maxHp": 20,
        "attack": 3,
        "defense": 3,
        "speed": 2,
        "luck": 4,
        "energy": 5
      },
      "startingDeck": [
        "recover",
        "focus",
        "guard",
        "strike"
      ]
    }
  ],
  "backgrounds": [
    {
      "id": "former_soldier",
      "label": "Former Soldier",
      "assetId": "former_soldier",
      "perk": "Gain +2 max HP."
    },
    {
      "id": "scholar",
      "label": "Scholar",
      "assetId": "scholar",
      "perk": "Start with +1 energy."
    },
    {
      "id": "traveler",
      "label": "Traveler",
      "assetId": "traveler",
      "perk": "Gain +1 speed."
    },
    {
      "id": "villager",
      "label": "Villager",
      "assetId": "villager",
      "perk": "Gain +1 defense."
    }
  ]
};
export default fateKnotsSelectionsManifest;
