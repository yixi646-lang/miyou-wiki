// 固定引擎 0932414ffcd0232e6784ce1c51524360c9313299；审核记录见 docs/圣遗物自动触发规则草案-2026-10-11.md
export const ARTIFACT_TRIGGER_SETS={
 "HeartOfTheFurnace": {
  "name": "炉火融炼之心",
  "conditions": {
   "4Stellar": [
    "",
    "on"
   ]
  },
  "labels": {
   "4Stellar": {
    "title": "角色触发星烁反应或造成星烁反应伤害",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "ScarletProof": {
  "name": "血红之证",
  "conditions": {
   "4Ss": [
    "",
    "on"
   ]
  },
  "labels": {
   "4Ss": {
    "title": "触发星扩散反应后",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "DisenchantmentInDeepShadow": {
  "name": "影中沉凝的幻灭",
  "conditions": {
   "state": [
    "",
    "on"
   ]
  },
  "labels": {
   "state": {
    "title": "敌人受到超导或星超导效果影响",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "CelestialGift": {
  "name": "天之美赐",
  "conditions": {
   "set4": [
    "",
    "on"
   ]
  },
  "labels": {
   "set4": {
    "title": "使用元素战技后",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "ADayCarvedFromRisingWinds": {
  "name": "风起之日",
  "conditions": {
   "set4": [
    "",
    "on"
   ]
  },
  "labels": {
   "set4": {
    "title": "普通攻击、重击、元素战技或元素爆发命中敌人后",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "AubadeOfMorningstarAndMoon": {
  "name": "晨星与月的晓歌",
  "conditions": {
   "set4": [
    "",
    "on"
   ]
  },
  "labels": {
   "set4": {
    "title": "角色处于后台",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "SilkenMoonsSerenade": {
  "name": "纺月的夜歌",
  "conditions": {
   "4GleamingMoon": [
    "",
    "on"
   ]
  },
  "labels": {
   "4GleamingMoon": {
    "title": "造成元素伤害后",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "NightOfTheSkysUnveiling": {
  "name": "穹境示现之夜",
  "conditions": {
   "4GleamingMoon": [
    "",
    "on"
   ]
  },
  "labels": {
   "4GleamingMoon": {
    "title": "队伍角色触发月曜反应后",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "FinaleOfTheDeepGalleries": {
  "name": "深廊终曲",
  "conditions": {
   "0EnergyNoBurst": [
    "",
    "on"
   ],
   "0EnergyNoNormal": [
    "",
    "on"
   ]
  },
  "labels": {
   "0EnergyNoBurst": {
    "title": "角色元素能量为0，且6秒内未造成元素爆发伤害",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   },
   "0EnergyNoNormal": {
    "title": "角色元素能量为0，且6秒内未造成普通攻击伤害",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "LongNightsOath": {
  "name": "长夜之誓",
  "conditions": {
   "stacks": [
    "",
    "1",
    "2",
    "3",
    "4",
    "5"
   ]
  },
  "labels": {
   "stacks": {
    "title": "层数",
    "values": {
     "1": "1 层",
     "2": "2 层",
     "3": "3 层",
     "4": "4 层",
     "5": "5 层",
     "": "未启用"
    }
   }
  }
 },
 "ObsidianCodex": {
  "name": "黑曜秘典",
  "conditions": {
   "2NightsoulBlessing": [
    "",
    "on"
   ],
   "4NightsoulConsume": [
    "",
    "on"
   ]
  },
  "labels": {
   "2NightsoulBlessing": {
    "title": "角色处于夜魂加持状态，且位于场上",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   },
   "4NightsoulConsume": {
    "title": "角色在场上消耗1点夜魂值后",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "ScrollOfTheHeroOfCinderCity": {
  "name": "烬城勇者绘卷",
  "conditions": {
   "react_anemo": [
    "",
    "anemo"
   ],
   "react_geo": [
    "",
    "geo"
   ],
   "react_electro": [
    "",
    "electro"
   ],
   "react_hydro": [
    "",
    "hydro"
   ],
   "react_cryo": [
    "",
    "cryo"
   ],
   "react_dendro": [
    "",
    "dendro"
   ],
   "react_pyro": [
    "",
    "pyro"
   ],
   "nightsoul_anemo": [
    "",
    "anemo"
   ],
   "nightsoul_geo": [
    "",
    "geo"
   ],
   "nightsoul_electro": [
    "",
    "electro"
   ],
   "nightsoul_hydro": [
    "",
    "hydro"
   ],
   "nightsoul_pyro": [
    "",
    "pyro"
   ],
   "nightsoul_cryo": [
    "",
    "cryo"
   ],
   "nightsoul_dendro": [
    "",
    "dendro"
   ]
  },
  "labels": {
   "react_anemo": {
    "title": "触发风元素相关反应后",
    "values": {
     "": "未启用",
     "anemo": "启用"
    }
   },
   "react_geo": {
    "title": "触发岩元素相关反应后",
    "values": {
     "": "未启用",
     "geo": "启用"
    }
   },
   "react_electro": {
    "title": "触发雷元素相关反应后",
    "values": {
     "": "未启用",
     "electro": "启用"
    }
   },
   "react_hydro": {
    "title": "触发水元素相关反应后",
    "values": {
     "": "未启用",
     "hydro": "启用"
    }
   },
   "react_cryo": {
    "title": "触发冰元素相关反应后",
    "values": {
     "": "未启用",
     "cryo": "启用"
    }
   },
   "react_dendro": {
    "title": "触发草元素相关反应后",
    "values": {
     "": "未启用",
     "dendro": "启用"
    }
   },
   "react_pyro": {
    "title": "触发火元素相关反应后",
    "values": {
     "": "未启用",
     "pyro": "启用"
    }
   },
   "nightsoul_anemo": {
    "title": "处于夜魂加持状态时触发风元素相关反应后",
    "values": {
     "": "未启用",
     "anemo": "启用"
    }
   },
   "nightsoul_geo": {
    "title": "处于夜魂加持状态时触发岩元素相关反应后",
    "values": {
     "": "未启用",
     "geo": "启用"
    }
   },
   "nightsoul_electro": {
    "title": "处于夜魂加持状态时触发雷元素相关反应后",
    "values": {
     "": "未启用",
     "electro": "启用"
    }
   },
   "nightsoul_hydro": {
    "title": "处于夜魂加持状态时触发水元素相关反应后",
    "values": {
     "": "未启用",
     "hydro": "启用"
    }
   },
   "nightsoul_pyro": {
    "title": "处于夜魂加持状态时触发火元素相关反应后",
    "values": {
     "": "未启用",
     "pyro": "启用"
    }
   },
   "nightsoul_cryo": {
    "title": "处于夜魂加持状态时触发冰元素相关反应后",
    "values": {
     "": "未启用",
     "cryo": "启用"
    }
   },
   "nightsoul_dendro": {
    "title": "处于夜魂加持状态时触发草元素相关反应后",
    "values": {
     "": "未启用",
     "dendro": "启用"
    }
   }
  }
 },
 "UnfinishedReverie": {
  "name": "未竟的遐思",
  "conditions": {
   "stacks": [
    "",
    "1",
    "2",
    "3",
    "4",
    "5"
   ]
  },
  "labels": {
   "stacks": {
    "title": "层数",
    "values": {
     "1": "1",
     "2": "2",
     "3": "3",
     "4": "4",
     "5": "5",
     "": "未启用"
    }
   }
  }
 },
 "FragmentOfHarmonicWhimsy": {
  "name": "谐律异想断章",
  "conditions": {
   "stacks": [
    "",
    "1",
    "2",
    "3"
   ]
  },
  "labels": {
   "stacks": {
    "title": "生命之契数值增加或减少后",
    "values": {
     "1": "1 次",
     "2": "2 次",
     "3": "3 次",
     "": "未启用"
    }
   }
  }
 },
 "NighttimeWhispersInTheEchoingWoods": {
  "name": "回声之林夜话",
  "conditions": {
   "afterSkill": [
    "",
    "on"
   ],
   "crystallize": [
    "",
    "on"
   ]
  },
  "labels": {
   "afterSkill": {
    "title": "元素战技命中敌人",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   },
   "crystallize": {
    "title": "处于结晶护盾庇护下，或附近存在月结晶反应形成的月笼",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "SongOfDaysPast": {
  "name": "昔时之歌",
  "conditions": {
   "healing": [
    "",
    "1000",
    "2000",
    "3000",
    "4000",
    "5000",
    "6000",
    "7000",
    "8000",
    "9000",
    "10000",
    "11000",
    "12000",
    "13000",
    "14000",
    "15000"
   ]
  },
  "labels": {
   "healing": {
    "title": "渴盼效果记录量",
    "values": {
     "1000": "1000",
     "2000": "2000",
     "3000": "3000",
     "4000": "4000",
     "5000": "5000",
     "6000": "6000",
     "7000": "7000",
     "8000": "8000",
     "9000": "9000",
     "10000": "10000",
     "11000": "11000",
     "12000": "12000",
     "13000": "13000",
     "14000": "14000",
     "15000": "15000",
     "": "未启用"
    }
   }
  }
 },
 "GoldenTroupe": {
  "name": "黄金剧团",
  "conditions": {
   "set4": [
    "",
    "on"
   ]
  },
  "labels": {
   "set4": {
    "title": "角色处于后台",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "MarechausseeHunter": {
  "name": "逐影猎人",
  "conditions": {
   "set4": [
    "",
    "1",
    "2",
    "3"
   ]
  },
  "labels": {
   "set4": {
    "title": "生命值变化后",
    "values": {
     "1": "1 层",
     "2": "2 层",
     "3": "3 层",
     "": "未启用"
    }
   }
  }
 },
 "VourukashasGlow": {
  "name": "花海甘露之光",
  "conditions": {
   "set4": [
    "",
    "1",
    "2",
    "3",
    "4",
    "5"
   ]
  },
  "labels": {
   "set4": {
    "title": "受到伤害后",
    "values": {
     "1": "1 层",
     "2": "2 层",
     "3": "3 层",
     "4": "4 层",
     "5": "5 层",
     "": "未启用"
    }
   }
  }
 },
 "NymphsDream": {
  "name": "水仙之梦",
  "conditions": {
   "set4": [
    "",
    "1",
    "2",
    "3"
   ]
  },
  "labels": {
   "set4": {
    "title": "镜中水仙",
    "values": {
     "1": "1 层",
     "2": "2 层",
     "3": "3 层",
     "": "未启用"
    }
   }
  }
 },
 "FlowerOfParadiseLost": {
  "name": "乐园遗落之花",
  "conditions": {
   "stacks": [
    "",
    "1",
    "2",
    "3",
    "4"
   ]
  },
  "labels": {
   "stacks": {
    "title": "出发绽放、超绽放或者烈绽放",
    "values": {
     "1": "1 层",
     "2": "2 层",
     "3": "3 层",
     "4": "4 层",
     "": "未启用"
    }
   }
  }
 },
 "DesertPavilionChronicle": {
  "name": "沙上楼阁史话",
  "conditions": {
   "set4": [
    "",
    "on"
   ]
  },
  "labels": {
   "set4": {
    "title": "重击命中敌人",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "GildedDreams": {
  "name": "饰金之梦",
  "conditions": {
   "passive": [
    "",
    "on"
   ],
   "overrideSame": [
    "",
    "0",
    "1",
    "2",
    "3"
   ],
   "overrideOther": [
    "",
    "0",
    "1",
    "2",
    "3"
   ]
  },
  "labels": {
   "passive": {
    "title": "触发元素反应后",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   },
   "overrideSame": {
    "title": "手动指定同元素队友数量",
    "values": {
     "0": "0 位成员",
     "1": "1 位成员",
     "2": "2 位成员",
     "3": "3 位成员",
     "": "未启用"
    }
   },
   "overrideOther": {
    "title": "手动指定不同元素队友数量",
    "values": {
     "0": "0 位成员",
     "1": "1 位成员",
     "2": "2 位成员",
     "3": "3 位成员",
     "": "未启用"
    }
   }
  }
 },
 "DeepwoodMemories": {
  "name": "深林的记忆",
  "conditions": {
   "set4": [
    "",
    "on"
   ]
  },
  "labels": {
   "set4": {
    "title": "元素战技或元素爆发命中敌人",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "EchoesOfAnOffering": {
  "name": "来歆余响",
  "conditions": {
   "mode": [
    "",
    "on",
    "avg",
    "0.3",
    "0.325",
    "0.35000000000000003",
    "0.37500000000000006",
    "0.4000000000000001",
    "0.4250000000000001",
    "0.4500000000000001",
    "0.47500000000000014"
   ]
  },
  "labels": {
   "mode": {
    "title": "触发模式",
    "values": {
     "": "未启用",
     "on": "始终",
     "avg": "平均",
     "0.3": "30.00%",
     "0.325": "32.50%",
     "0.35000000000000003": "35.00%",
     "0.37500000000000006": "37.50%",
     "0.4000000000000001": "40.00%",
     "0.4250000000000001": "42.50%",
     "0.4500000000000001": "45.00%",
     "0.47500000000000014": "47.50%"
    }
   }
  }
 },
 "VermillionHereafter": {
  "name": "辰砂往生录",
  "conditions": {
   "afterBurst": [
    "",
    "on"
   ],
   "stacks": [
    "",
    "1",
    "2",
    "3",
    "4"
   ]
  },
  "labels": {
   "afterBurst": {
    "title": "使用元素爆发后",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   },
   "stacks": {
    "title": "层数",
    "values": {
     "1": "1 层",
     "2": "2 层",
     "3": "3 层",
     "4": "4 层",
     "": "未启用"
    }
   }
  }
 },
 "OceanHuedClam": {
  "name": "海染砗磲",
  "conditions": {},
  "labels": {}
 },
 "HuskOfOpulentDreams": {
  "name": "华馆梦醒形骸记",
  "conditions": {
   "stack": [
    "",
    "1",
    "2",
    "3",
    "4"
   ]
  },
  "labels": {
   "stack": {
    "title": "问答",
    "values": {
     "1": "1 层",
     "2": "2 层",
     "3": "3 层",
     "4": "4 层",
     "": "未启用"
    }
   }
  }
 },
 "EmblemOfSeveredFate": {
  "name": "绝缘之旗印",
  "conditions": {},
  "labels": {}
 },
 "ShimenawasReminiscence": {
  "name": "追忆之注连",
  "conditions": {
   "usedEnergy": [
    "",
    "used"
   ]
  },
  "labels": {
   "usedEnergy": {
    "title": "流失15点元素能量后",
    "values": {
     "": "未启用",
     "used": "触发"
    }
   }
  }
 },
 "PaleFlame": {
  "name": "苍白之火",
  "conditions": {
   "stacks": [
    "",
    "1",
    "2"
   ]
  },
  "labels": {
   "stacks": {
    "title": "元素战技命中敌人",
    "values": {
     "1": "1",
     "2": "2",
     "": "未启用"
    }
   }
  }
 },
 "TenacityOfTheMillelith": {
  "name": "千岩牢固",
  "conditions": {
   "skill": [
    "",
    "cast"
   ]
  },
  "labels": {
   "skill": {
    "title": "元素战技命中敌人",
    "values": {
     "": "未启用",
     "cast": "触发"
    }
   }
  }
 },
 "HeartOfDepth": {
  "name": "沉沦之心",
  "conditions": {
   "skill": [
    "",
    "cast"
   ]
  },
  "labels": {
   "skill": {
    "title": "使用元素战技后",
    "values": {
     "": "未启用",
     "cast": "触发"
    }
   }
  }
 },
 "BlizzardStrayer": {
  "name": "冰风迷途的勇士",
  "conditions": {
   "state": [
    "",
    "cryo",
    "frozen"
   ]
  },
  "labels": {
   "state": {
    "title": "攻击敌人",
    "values": {
     "": "未启用",
     "cryo": "处于冰元素影响下",
     "frozen": "处于冻结状态下"
    }
   }
  }
 },
 "RetracingBolide": {
  "name": "逆飞的流星",
  "conditions": {
   "state": [
    "",
    "on"
   ]
  },
  "labels": {
   "state": {
    "title": "处于护盾庇护下",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "ArchaicPetra": {
  "name": "悠古的磐岩",
  "conditions": {
   "element": [
    "",
    "hydro",
    "pyro",
    "cryo",
    "electro"
   ]
  },
  "labels": {
   "element": {
    "title": "获得结晶反应形成的晶片",
    "values": {
     "": "未启用",
     "hydro": "水元素",
     "pyro": "火",
     "cryo": "冰",
     "electro": "雷"
    }
   }
  }
 },
 "PrayersToSpringtime": {
  "name": "祭冰之人",
  "conditions": {},
  "labels": {}
 },
 "PrayersForWisdom": {
  "name": "祭雷之人",
  "conditions": {},
  "labels": {}
 },
 "PrayersForDestiny": {
  "name": "祭水之人",
  "conditions": {},
  "labels": {}
 },
 "PrayersForIllumination": {
  "name": "祭火之人",
  "conditions": {},
  "labels": {}
 },
 "BloodstainedChivalry": {
  "name": "染血的骑士道",
  "conditions": {
   "defeat": [
    "",
    "hit"
   ]
  },
  "labels": {
   "defeat": {
    "title": "击败敌人后",
    "values": {
     "": "未启用",
     "hit": "触发"
    }
   }
  }
 },
 "NoblesseOblige": {
  "name": "昔日宗室之仪",
  "conditions": {
   "set4": [
    "",
    "on"
   ]
  },
  "labels": {
   "set4": {
    "title": "使用元素爆发后",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "CrimsonWitchOfFlames": {
  "name": "炽烈的炎之魔女",
  "conditions": {
   "stack": [
    "",
    "1",
    "2",
    "3"
   ]
  },
  "labels": {
   "stack": {
    "title": "使用元素战技后",
    "values": {
     "1": "1 层",
     "2": "2 层",
     "3": "3 层",
     "": "未启用"
    }
   }
  }
 },
 "ThunderingFury": {
  "name": "如雷的盛怒",
  "conditions": {},
  "labels": {}
 },
 "WanderersTroupe": {
  "name": "流浪大地的乐团",
  "conditions": {},
  "labels": {}
 },
 "ViridescentVenerer": {
  "name": "翠绿之影",
  "conditions": {
   "swirlhydro": [
    "",
    "hydro"
   ],
   "swirlpyro": [
    "",
    "pyro"
   ],
   "swirlcryo": [
    "",
    "cryo"
   ],
   "swirlelectro": [
    "",
    "electro"
   ]
  },
  "labels": {
   "swirlhydro": {
    "title": "触发水扩散反应",
    "values": {
     "": "未启用",
     "hydro": "启用"
    }
   },
   "swirlpyro": {
    "title": "触发火扩散反应",
    "values": {
     "": "未启用",
     "pyro": "启用"
    }
   },
   "swirlcryo": {
    "title": "触发冰扩散反应",
    "values": {
     "": "未启用",
     "cryo": "启用"
    }
   },
   "swirlelectro": {
    "title": "触发雷扩散反应",
    "values": {
     "": "未启用",
     "electro": "启用"
    }
   }
  }
 },
 "GladiatorsFinale": {
  "name": "角斗士的终幕礼",
  "conditions": {},
  "labels": {}
 },
 "MaidenBeloved": {
  "name": "被怜爱的少女",
  "conditions": {
   "state": [
    "",
    "on"
   ]
  },
  "labels": {
   "state": {
    "title": "释放元素战技或元素爆发后",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "Lavawalker": {
  "name": "渡过烈火的贤人",
  "conditions": {
   "state": [
    "",
    "on"
   ]
  },
  "labels": {
   "state": {
    "title": "敌人受到燃烧或火元素影响",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "Thundersoother": {
  "name": "平息鸣雷的尊者",
  "conditions": {
   "state": [
    "",
    "on"
   ]
  },
  "labels": {
   "state": {
    "title": "敌人处于雷元素影响下",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "TravelingDoctor": {
  "name": "游医",
  "conditions": {},
  "labels": {}
 },
 "Scholar": {
  "name": "学士",
  "conditions": {},
  "labels": {}
 },
 "LuckyDog": {
  "name": "幸运儿",
  "conditions": {},
  "labels": {}
 },
 "Adventurer": {
  "name": "冒险家",
  "conditions": {},
  "labels": {}
 },
 "TheExile": {
  "name": "流放者",
  "conditions": {},
  "labels": {}
 },
 "Gambler": {
  "name": "赌徒",
  "conditions": {},
  "labels": {}
 },
 "Instructor": {
  "name": "教官",
  "conditions": {
   "set4": [
    "",
    "on"
   ]
  },
  "labels": {
   "set4": {
    "title": "触发元素反应后",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "MartialArtist": {
  "name": "武人",
  "conditions": {
   "state": [
    "",
    "on"
   ]
  },
  "labels": {
   "state": {
    "title": "使用元素战技后",
    "values": {
     "": "未启用",
     "on": "启用"
    }
   }
  }
 },
 "Berserker": {
  "name": "战狂",
  "conditions": {
   "hp": [
    "",
    "70"
   ]
  },
  "labels": {
   "hp": {
    "title": "生命值低于70%",
    "values": {
     "70": "70 层",
     "": "未启用"
    }
   }
  }
 },
 "TinyMiracle": {
  "name": "奇迹",
  "conditions": {
   "element": [
    "",
    "anemo",
    "geo",
    "electro",
    "hydro",
    "pyro",
    "cryo",
    "dendro"
   ]
  },
  "labels": {
   "element": {
    "title": "受到某个元素类型的伤害后",
    "values": {
     "": "未启用",
     "anemo": "风",
     "geo": "岩元素",
     "electro": "雷",
     "hydro": "水元素",
     "pyro": "火",
     "cryo": "冰",
     "dendro": "草元素"
    }
   }
  }
 },
 "DefendersWill": {
  "name": "守护之心",
  "conditions": {},
  "labels": {}
 },
 "BraveHeart": {
  "name": "勇士之心",
  "conditions": {
   "hp": [
    "",
    "50"
   ]
  },
  "labels": {
   "hp": {
    "title": "敌人生命值高于50%",
    "values": {
     "50": "50 层",
     "": "未启用"
    }
   }
  }
 },
 "ResolutionOfSojourner": {
  "name": "行者之心",
  "conditions": {},
  "labels": {}
 }
};
export const ARTIFACT_TRIGGER_PROFILES={
 "Vesna": {
  "name": "薇斯纳",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "skillArmed",
    "title": "处于巡风列装模式"
   },
   {
    "field": "a1Stacks",
    "title": "整肃层数"
   },
   {
    "field": "a0StellarRadiance",
    "title": "队伍中角色触发星扩散反应后"
   }
  ]
 },
 "Vodyanitsa": {
  "name": "沃雅妮莎",
  "element": "hydro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "skillHit",
    "title": "元素战技命中敌人"
   },
   {
    "field": "skillSong",
    "title": "处于遥久之歌状态"
   },
   {
    "field": "a1Vortex",
    "title": "创造或引爆流荡风旋后"
   },
   {
    "field": "a4Vortex",
    "title": "存在流荡风旋或处于引爆后的5秒内（领唱/重唱增益星扩散）"
   },
   {
    "field": "a4LeadVocal",
    "title": "消耗一层领唱"
   },
   {
    "field": "a4Chorus",
    "title": "消耗一层重唱"
   },
   {
    "field": "c1Heal",
    "title": "触发遥久之歌治疗后"
   },
   {
    "field": "c2State",
    "title": "黑与白的双音状态"
   },
   {
    "field": "c4State",
    "title": "触发遥久之歌治疗后"
   }
  ]
 },
 "Odette": {
  "name": "奥黛塔",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "burst",
    "title": "使用元素爆发后"
   },
   {
    "field": "a1TeamSplendor",
    "title": "赋予附近队伍角色的华彩层数"
   },
   {
    "field": "a0StellarRadiance",
    "title": "辉映状态"
   },
   {
    "field": "c2NearOpponent",
    "title": "敌人处于独舞倒影附近"
   }
  ]
 },
 "Alyosha": {
  "name": "阿罗夏",
  "element": "electro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "skillPrecision",
    "title": "猎者之准层数"
   },
   {
    "field": "a0StellarRadianceSc",
    "title": "角色处于极星辉域内"
   }
  ]
 },
 "Sandrone": {
  "name": "桑多涅",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a1Decoding",
    "title": "法洁欧的解算功率超过50点"
   },
   {
    "field": "a1Tactics",
    "title": "消耗的改进战术层数"
   },
   {
    "field": "a0StellarRadianceSc",
    "title": "辉映状态"
   },
   {
    "field": "c1Decoding",
    "title": "处于解算模式"
   },
   {
    "field": "c2Stacks",
    "title": "重击冷凝射线发射次数"
   }
  ]
 },
 "Lohen": {
  "name": "洛恩",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "willConsumed",
    "title": "消耗的争胜点数"
   },
   {
    "field": "a4MasterCryo",
    "title": "奇谋状态下，附近队伍角色触发冰元素相关反应后"
   },
   {
    "field": "a0HighSpirits",
    "title": "处于乘兴效果下"
   },
   {
    "field": "lockHomework",
    "title": "完成魔女的课业后"
   },
   {
    "field": "lockBuff",
    "title": "施放特殊元素战技或元素爆发后，争胜不低于上限的50%"
   },
   {
    "field": "c2Blade",
    "title": "触发破邪之刃后"
   },
   {
    "field": "c6BurstMaster",
    "title": "奇谋状态下施放元素爆发"
   }
  ]
 },
 "Prune": {
  "name": "布伦妮",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a4Rally",
    "title": "角色处于振铃鼓舞效果下"
   },
   {
    "field": "lockHomework",
    "title": "完成魔女的课业后"
   },
   {
    "field": "lockRallyReaction",
    "title": "处于振铃鼓舞效果下的魔导角色触发元素反应后"
   },
   {
    "field": "c2Stack",
    "title": "层数"
   },
   {
    "field": "c6RallyReaction",
    "title": "处于振铃鼓舞效果下的角色触发元素反应后"
   }
  ]
 },
 "Nicole": {
  "name": "尼可",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "skillGraceActive",
    "title": "处于虚己之赐效果下"
   },
   {
    "field": "a1GuidanceActive",
    "title": "当前场上角色处于圣祝之引效果下"
   },
   {
    "field": "a4NicoleGuidance",
    "title": "尼可处于圣祝之引效果下"
   },
   {
    "field": "lockHomework",
    "title": "完成魔女的课业后"
   },
   {
    "field": "c4Pathfinder",
    "title": "处于先导之佑效果下"
   }
  ]
 },
 "Linnea": {
  "name": "莉奈娅",
  "element": "geo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a1Lumi",
    "title": "露米在场"
   },
   {
    "field": "c1TeamStacks",
    "title": "消耗一层历览编录后"
   },
   {
    "field": "c1LumiStacks",
    "title": "消耗的历览编录层数"
   },
   {
    "field": "c2Moondrift",
    "title": "触发月笼谐奏后"
   },
   {
    "field": "c4Moondrift",
    "title": "触发月笼谐奏后"
   }
  ]
 },
 "Varka": {
  "name": "法尔伽",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a4Stacks",
    "title": "层数"
   },
   {
    "field": "lockHomework",
    "title": "完成魔女的课业后"
   },
   {
    "field": "c4Swirlhydro",
    "title": "触发水扩散反应"
   },
   {
    "field": "c4Swirlpyro",
    "title": "触发火扩散反应"
   },
   {
    "field": "c4Swirlcryo",
    "title": "触发冰扩散反应"
   },
   {
    "field": "c4Swirlelectro",
    "title": "触发雷扩散反应"
   }
  ]
 },
 "Illuga": {
  "name": "叶洛亚",
  "element": "geo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "burstSong",
    "title": "消耗夜莺之歌层数后"
   },
   {
    "field": "a1AfterSkillBurst",
    "title": "释放元素战技或元素爆发后"
   },
   {
    "field": "c4BurstActive",
    "title": "元素爆发效果已生效"
   }
  ]
 },
 "Zibai": {
  "name": "兹白",
  "element": "geo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a1Moonfall",
    "title": "处于太阴降效果下"
   },
   {
    "field": "c1FirstStride",
    "title": "进入月转时隙模式后的首次灵驹飞踏"
   },
   {
    "field": "c2ShiftMode",
    "title": "处于月转时隙模式"
   },
   {
    "field": "c4Splendor",
    "title": "处于月涣华效果下"
   },
   {
    "field": "c6Point",
    "title": "消耗的时隙浮光超过70点的部分"
   }
  ]
 },
 "Columbina": {
  "name": "哥伦比娅",
  "element": "hydro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "burstDomain",
    "title": "领域内的当前场上角色"
   },
   {
    "field": "a1Stacks",
    "title": "层数"
   },
   {
    "field": "c2Brilliance",
    "title": "处于皎辉效果下"
   },
   {
    "field": "c2Lunarcharged",
    "title": "引力干涉触发月感电"
   },
   {
    "field": "c2Lunarbloom",
    "title": "引力干涉触发月绽放"
   },
   {
    "field": "c2Lunarcrystallize",
    "title": "引力干涉触发月结晶"
   },
   {
    "field": "c4Buff",
    "title": "引力干涉增益已生效"
   },
   {
    "field": "c6Lunarcharged",
    "title": "队伍角色在月之领域内触发月感电反应后"
   },
   {
    "field": "c6Lunarbloom",
    "title": "队伍角色在月之领域内触发月绽放反应后"
   },
   {
    "field": "c6Lunarcrystallize",
    "title": "队伍角色在月之领域内触发月结晶反应后"
   }
  ]
 },
 "Jahoda": {
  "name": "雅珂达",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "a4Heal",
    "title": "猫型家用互助协调器治疗生命值高于70%的场上角色后"
   },
   {
    "field": "c6FlaskFull",
    "title": "呼噜噜秘藏瓶装满后"
   }
  ]
 },
 "Durin": {
  "name": "杜林",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "burstForm",
    "title": "本质转变状态"
   },
   {
    "field": "a1WhiteDendro",
    "title": "队伍角色触发燃烧反应，或对燃烧中的敌人造成火或草元素伤害后"
   },
   {
    "field": "a1WhiteElectro",
    "title": "队伍角色触发超载反应后"
   },
   {
    "field": "a1WhiteAnemo",
    "title": "队伍角色触发火元素扩散反应后"
   },
   {
    "field": "a1WhiteGeo",
    "title": "队伍角色触发火元素结晶反应后"
   },
   {
    "field": "a4Stack",
    "title": "消耗肇象熔炼层数后"
   },
   {
    "field": "lockHomework",
    "title": "完成魔女的课业后"
   },
   {
    "field": "c1Stacks",
    "title": "消耗轮变启迪层数后"
   },
   {
    "field": "c2AfterBurst",
    "title": "使用元素爆发后"
   },
   {
    "field": "c2Hydro",
    "title": "队伍角色触发蒸发反应后"
   },
   {
    "field": "c2Cryo",
    "title": "队伍角色触发融化反应后"
   },
   {
    "field": "c6LightBurstHit",
    "title": "元素爆发命中敌人"
   }
  ]
 },
 "Nefer": {
  "name": "奈芙尔",
  "element": "dendro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "burstVeilsAbsorbed",
    "title": "消耗的伪秘之帷层数"
   },
   {
    "field": "a1VeilStacks",
    "title": "伪秘之帷层数"
   },
   {
    "field": "c4ShadowDance",
    "title": "奈芙尔处于影舞状态"
   }
  ]
 },
 "Flins": {
  "name": "菲林斯",
  "element": "electro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c2AfterElectro",
    "title": "对敌雷元素伤害攻击"
   }
  ]
 },
 "Aino": {
  "name": "爱诺",
  "element": "hydro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c1AfterSkillOrBurst",
    "title": "释放元素战技或元素爆发后"
   },
   {
    "field": "c6AfterBurst",
    "title": "使用元素爆发后"
   }
  ]
 },
 "Lauma": {
  "name": "菈乌玛",
  "element": "dendro",
  "burst": false,
  "sustainedSkill": true,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "skillVerdantDew",
    "title": "消耗的草露数量"
   },
   {
    "field": "skillAfterHit",
    "title": "元素战技命中敌人"
   },
   {
    "field": "burstPaleHymn",
    "title": "消耗苍色祷歌层数后"
   },
   {
    "field": "a1AfterSkill",
    "title": "使用元素战技后"
   }
  ]
 },
 "Ineffa": {
  "name": "伊涅芙",
  "element": "electro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a4AfterBurst",
    "title": "使用元素爆发后"
   },
   {
    "field": "c1AfterShield",
    "title": "伊涅芙激活光流护障后"
   }
  ]
 },
 "Dahlia": {
  "name": "塔利雅",
  "element": "hydro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "burstActive",
    "title": "当前场上角色处于西风之眷效果下"
   },
   {
    "field": "c2BurstConsumed",
    "title": "消耗纯耀的祷咏的祝颂层数后"
   }
  ]
 },
 "Skirk": {
  "name": "丝柯克",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "burstSerpentOver",
    "title": "消耗的蛇之狡谋超过50点的部分"
   },
   {
    "field": "burstVoidAbsorb",
    "title": "施放极恶技·尽时吸收的虚境裂隙数量"
   },
   {
    "field": "a4DeathStacks",
    "title": "死河渡断层数"
   },
   {
    "field": "c2AfterBurst",
    "title": "七相一闪模式下施放极恶技·尽后"
   }
  ]
 },
 "Ifa": {
  "name": "伊法",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": true,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "a1Essentials",
    "title": "救援要义点数"
   },
   {
    "field": "a4NsBurst",
    "title": "附近队伍角色触发夜魂迸发后"
   },
   {
    "field": "c4AfterBurst",
    "title": "使用元素爆发后"
   }
  ]
 },
 "Escoffier": {
  "name": "爱可菲",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "a4SkillBurstHit",
    "title": "元素战技或元素爆发命中敌人"
   },
   {
    "field": "c1AfterSkillBurst",
    "title": "释放元素战技或元素爆发后"
   },
   {
    "field": "c2Stacks",
    "title": "消耗冷煮计数后"
   }
  ]
 },
 "Varesa": {
  "name": "瓦雷莎",
  "element": "electro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": true,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a1Rainbow",
    "title": "处于虹色坠击效果下"
   },
   {
    "field": "a4NsBurst",
    "title": "附近队伍角色触发夜魂迸发后"
   },
   {
    "field": "c4Diligent",
    "title": "处于精进勇猛效果下"
   },
   {
    "field": "c4FpApex",
    "title": "处于炽热激情或极限驱动状态"
   }
  ]
 },
 "Iansan": {
  "name": "伊安珊",
  "element": "electro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": true,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "burstNs",
    "title": "当前夜魂值"
   },
   {
    "field": "a1Precise",
    "title": "处于标准动作效果下"
   },
   {
    "field": "c6Extreme",
    "title": "处于极限发力效果下"
   }
  ]
 },
 "YumemizukiMizuki": {
  "name": "梦见月瑞希",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "skillDream",
    "title": "处于梦浮状态"
   },
   {
    "field": "a4Phec",
    "title": "梦浮状态下，附近队伍角色以火、水、冰或雷元素攻击命中敌人后"
   },
   {
    "field": "lockRevelation",
    "title": "完成魔女的启示后"
   },
   {
    "field": "lockStellarRadiance",
    "title": "触发星扩散反应后"
   },
   {
    "field": "c1Awaiting",
    "title": "敌人处于二十三夜待效果下"
   }
  ]
 },
 "LanYan": {
  "name": "蓝砚",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c4AfterBurst",
    "title": "使用元素爆发后"
   }
  ]
 },
 "Citlali": {
  "name": "茜特菈莉",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": true,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c6NsConsumed",
    "title": "消耗的夜魂值"
   },
   {
    "field": "a1NsFreezeMelt",
    "title": "伊兹帕帕在场时，附近队伍角色触发冻结或融化反应后"
   },
   {
    "field": "c1BladeConsume",
    "title": "消耗星刃后"
   },
   {
    "field": "c2ShieldEleMas",
    "title": "角色处于白曜护盾庇护下"
   }
  ]
 },
 "Mavuika": {
  "name": "玛薇卡",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": true,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "burstSpirit",
    "title": "消耗的战意"
   },
   {
    "field": "a4TimeSinceBurst",
    "title": "施放元素爆发后的时间"
   },
   {
    "field": "a1NsBurst",
    "title": "附近队伍角色触发夜魂迸发后"
   },
   {
    "field": "c1GainSpirit",
    "title": "获得战意后"
   },
   {
    "field": "c2FlameForm",
    "title": "处于驰轮车形态"
   },
   {
    "field": "c2RingForm",
    "title": "处于焚曜之环形态"
   }
  ]
 },
 "Ororon": {
  "name": "欧洛伦",
  "element": "electro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": true,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c1AfterSkillHit",
    "title": "元素战技命中敌人"
   },
   {
    "field": "c2Supersense",
    "title": "使用元素爆发后"
   },
   {
    "field": "c2BurstHitStack",
    "title": "元素爆发命中敌人"
   },
   {
    "field": "c6Stacks",
    "title": "显象超感触发次数"
   }
  ]
 },
 "Chasca": {
  "name": "恰斯卡",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": true,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a1InMultitarget",
    "title": "处于多重瞄准状态"
   },
   {
    "field": "c6FatalRounds",
    "title": "处于命袭状态"
   }
  ]
 },
 "Xilonen": {
  "name": "希诺宁",
  "element": "geo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": true,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "sourceActive",
    "title": "夜魂值达到上限后"
   },
   {
    "field": "nsBlessing",
    "title": "处于夜魂加持状态"
   },
   {
    "field": "nsBurst",
    "title": "附近队伍角色触发夜魂迸发后"
   },
   {
    "field": "c4Blooming",
    "title": "处于荣花之赐效果下"
   },
   {
    "field": "c6Imperishable",
    "title": "处于永夜的祝福状态"
   }
  ]
 },
 "Kinich": {
  "name": "基尼奇",
  "element": "dendro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": true,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a4Stacks",
    "title": "猎人心得层数"
   },
   {
    "field": "c2Hit",
    "title": "元素战技命中敌人"
   },
   {
    "field": "c2FirstHit",
    "title": "首次发射迴猎贯鳞炮"
   }
  ]
 },
 "Mualani": {
  "name": "玛拉妮",
  "element": "hydro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": true,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a4Stacks",
    "title": "逐浪心得层数"
   }
  ]
 },
 "Kachina": {
  "name": "卡齐娜",
  "element": "geo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": true,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c4Opponents",
    "title": "领域内敌人数量"
   },
   {
    "field": "a1NightsoulBurst",
    "title": "附近队伍角色触发夜魂迸发后"
   }
  ]
 },
 "Emilie": {
  "name": "艾梅莉埃",
  "element": "dendro",
  "burst": false,
  "sustainedSkill": true,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a4Burning",
    "title": "敌人处于燃烧状态"
   },
   {
    "field": "c2Hit",
    "title": "撷萃调香、香氛演绎或清露香氛命中敌人后"
   },
   {
    "field": "c6Fragrance",
    "title": "处于香迹留驻效果下"
   }
  ]
 },
 "Sigewinne": {
  "name": "希格雯",
  "element": "hydro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "skillTier",
    "title": "激愈水球等级"
   },
   {
    "field": "a1BedRest",
    "title": "使用元素战技后"
   },
   {
    "field": "a1Conva",
    "title": "消耗静养计数后"
   },
   {
    "field": "c6AfterHeal",
    "title": "进行治疗后"
   },
   {
    "field": "a4TeamBond",
    "title": "全队生命之契总量"
   },
   {
    "field": "c2AfterHit",
    "title": "元素战技或元素爆发命中敌人"
   }
  ]
 },
 "Clorinde": {
  "name": "克洛琳德",
  "element": "electro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c6AfterSkill",
    "title": "使用元素战技后"
   },
   {
    "field": "c4BondPercent",
    "title": "当前生命之契百分比"
   },
   {
    "field": "a1Reactions",
    "title": "附近队伍角色触发雷元素相关反应后"
   },
   {
    "field": "a4BondChanges",
    "title": "生命之契数值增加或减少后"
   }
  ]
 },
 "Sethos": {
  "name": "赛索斯",
  "element": "electro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a4Sandshade",
    "title": "处于热砂炫影效果下"
   },
   {
    "field": "c2Stacks",
    "title": "层数"
   },
   {
    "field": "c4Strike",
    "title": "贯影箭或瞑弦矢命中两名以上敌人后"
   }
  ]
 },
 "Arlecchino": {
  "name": "阿蕾奇诺",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "bondPercent",
    "title": "当前生命之契百分比"
   },
   {
    "field": "c6AfterSkill",
    "title": "使用元素战技后"
   },
   {
    "field": "c2AfterAbsorb",
    "title": "吸收血偿勒令后"
   }
  ]
 },
 "Chiori": {
  "name": "千织",
  "element": "geo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a1Infusion",
    "title": "处于裁锦效果下"
   },
   {
    "field": "a4Construct",
    "title": "附近队伍角色创造岩元素创造物后"
   }
  ]
 },
 "Xianyun": {
  "name": "闲云",
  "element": "anemo",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "c2AfterSkill",
    "title": "使用元素战技后"
   },
   {
    "field": "c6SkyladderUses",
    "title": "步天梯施放次数"
   },
   {
    "field": "a4HasStacks",
    "title": "竹星持有仙力助推层数"
   },
   {
    "field": "a1Stacks",
    "title": "风翎层数"
   }
  ]
 },
 "Gaming": {
  "name": "嘉明",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": true,
  "healer": false,
  "signals": [
   {
    "field": "a4HpState",
    "title": "%当前生命值"
   },
   {
    "field": "c2Overheal",
    "title": "治疗量溢出后"
   }
  ]
 },
 "Chevreuse": {
  "name": "夏沃蕾",
  "element": "pyro",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "a4AfterBall",
    "title": "发射超量装药弹头后"
   },
   {
    "field": "c6AfterHealStacks",
    "title": "受到近迫式急促拦射治疗后"
   },
   {
    "field": "a1AfterOverload",
    "title": "触发超载反应后"
   }
  ]
 },
 "Navia": {
  "name": "娜维娅",
  "element": "geo",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a1AfterSkill",
    "title": "使用元素战技后"
   },
   {
    "field": "skillCharges",
    "title": "消耗的裂晶弹片数量"
   },
   {
    "field": "shotsHit",
    "title": "命中的玫瑰晶弹数量"
   },
   {
    "field": "c4AfterBurstHit",
    "title": "元素爆发命中敌人"
   }
  ]
 },
 "Furina": {
  "name": "芙宁娜",
  "element": "hydro",
  "burst": true,
  "sustainedSkill": true,
  "nightSoul": false,
  "hpCycle": true,
  "healer": false,
  "signals": [
   {
    "field": "c6",
    "title": "使用元素战技后"
   },
   {
    "field": "c6Pneuma",
    "title": "处于芒性状态"
   },
   {
    "field": "skillHpConsumeStacks",
    "title": "贡献生命值的角色数量"
   },
   {
    "field": "burstFanfare",
    "title": "气氛值"
   },
   {
    "field": "c2Overstack",
    "title": "超出上限的气氛值"
   }
  ]
 },
 "Charlotte": {
  "name": "夏洛蒂",
  "element": "cryo",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "c2Hit",
    "title": "温亨廷先生命中的敌人数量"
   },
   {
    "field": "c4Marked",
    "title": "敌人被瞬时剪影或聚焦印象标记"
   }
  ]
 },
 "Wriothesley": {
  "name": "莱欧斯利",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": true,
  "healer": false,
  "signals": [
   {
    "field": "a4EdictStacks",
    "title": "检偿之敕层数"
   },
   {
    "field": "lockRevelation",
    "title": "完成魔女的启示后"
   },
   {
    "field": "lockStellarRadianceSc",
    "title": "角色处于极星辉域内"
   },
   {
    "field": "c1Luster",
    "title": "恩典之诫·显明命中敌人后"
   },
   {
    "field": "c15Hit",
    "title": "迅烈倾霜拳五段命中敌人后"
   }
  ]
 },
 "Neuvillette": {
  "name": "那维莱特",
  "element": "hydro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": true,
  "healer": false,
  "signals": [
   {
    "field": "a1Stacks",
    "title": "遗龙之荣层数"
   },
   {
    "field": "a4Hp",
    "title": "%当前生命值"
   }
  ]
 },
 "Freminet": {
  "name": "菲米尼",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a4AfterShatter",
    "title": "触发碎冰反应后"
   },
   {
    "field": "stalk",
    "title": "使用元素爆发后"
   },
   {
    "field": "c4C6Stacks",
    "title": "触发冰元素相关反应后"
   }
  ]
 },
 "Lyney": {
  "name": "林尼",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": true,
  "healer": false,
  "signals": [
   {
    "field": "a1DrainHp",
    "title": "隐具魔术箭消耗生命值后"
   },
   {
    "field": "propStacks",
    "title": "消耗的隐具余数层数"
   },
   {
    "field": "a4AffectedByPyro",
    "title": "敌人受到火元素影响"
   },
   {
    "field": "c2Stacks",
    "title": "站场时间"
   },
   {
    "field": "c4Hit",
    "title": "重击命中敌人"
   }
  ]
 },
 "Lynette": {
  "name": "琳妮特",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c6AfterThrust",
    "title": "施放谜影障身法的谜身影盗后"
   },
   {
    "field": "burstAbsorb",
    "title": "元素转化"
   },
   {
    "field": "a1AfterBurst",
    "title": "使用元素爆发后"
   }
  ]
 },
 "Kirara": {
  "name": "绮良良",
  "element": "dendro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c6AfterSkillBurst",
    "title": "释放元素战技或元素爆发后"
   }
  ]
 },
 "Baizhu": {
  "name": "白术",
  "element": "dendro",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "a4AfterHeal",
    "title": "处于「木运之岁」效果中"
   },
   {
    "field": "c4AfterBurst",
    "title": "使用元素爆发后"
   },
   {
    "field": "a1HpStatus",
    "title": "当前站场角色"
   }
  ]
 },
 "Kaveh": {
  "name": "卡维",
  "element": "dendro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c1AfterSkill",
    "title": "元素战技命中敌人"
   },
   {
    "field": "afterBurst",
    "title": "使用元素爆发后"
   },
   {
    "field": "a4Stacks",
    "title": "普通/蓄力/下落攻击命中敌人"
   }
  ]
 },
 "Mika": {
  "name": "米卡",
  "element": "cryo",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "inSoulwind",
    "title": "处于灵风状态下"
   },
   {
    "field": "a1DetectorStacks",
    "title": "侦明效果"
   },
   {
    "field": "c6Crit",
    "title": "处于灵风状态下"
   }
  ]
 },
 "Dehya": {
  "name": "迪希雅",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": true,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c2InField",
    "title": "净焰剑狱领域中的敌人受到伤害后"
   },
   {
    "field": "c6CritStacks",
    "title": "炽鬃拳暴击后"
   }
  ]
 },
 "Alhaitham": {
  "name": "艾尔海森",
  "element": "dendro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "withMirrors",
    "title": "持有琢光镜"
   },
   {
    "field": "mirrorsConsumed",
    "title": "殊境·显象缚结施放消耗的琢光镜数量"
   },
   {
    "field": "debateStacks",
    "title": "辩章层数"
   },
   {
    "field": "excessMirror",
    "title": "琢光镜数量已达到上限后，再产生琢光镜"
   }
  ]
 },
 "Yaoyao": {
  "name": "瑶瑶",
  "element": "dendro",
  "burst": true,
  "sustainedSkill": true,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "adeptalLegacy",
    "title": "处于桂子仙机状态"
   },
   {
    "field": "c1Explode",
    "title": "在白玉萝卜炸裂范围内"
   },
   {
    "field": "c4AfterSkillBurst",
    "title": "释放元素战技或元素爆发后"
   }
  ]
 },
 "Faruzan": {
  "name": "珐露珊",
  "element": "anemo",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "burstBenefit",
    "title": "受风的秘密方式祈祷风的益处影响"
   },
   {
    "field": "burstHit",
    "title": "敌人受到诡风之祸影响"
   },
   {
    "field": "a4Active",
    "title": "七窟遗智是有效的"
   },
   {
    "field": "c6Crit",
    "title": "受风的秘密方式祈祷风的益处影响"
   }
  ]
 },
 "Wanderer": {
  "name": "流浪者",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "afterSkill",
    "title": "在优风倾姿状态下"
   },
   {
    "field": "skillPyroContact",
    "title": "羽画: 风姿华歌 若接触了 火元素"
   },
   {
    "field": "skillCryoContact",
    "title": "羽画: 风姿华歌 若接触了 冰元素"
   },
   {
    "field": "c2Points",
    "title": "空居力上限与当前的空居力的差值"
   }
  ]
 },
 "Layla": {
  "name": "莱依拉",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a1Stacks",
    "title": "层数"
   },
   {
    "field": "c4Active",
    "title": "在启明的影响下"
   }
  ]
 },
 "Nahida": {
  "name": "纳西妲",
  "element": "dendro",
  "burst": false,
  "sustainedSkill": true,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c2Bloom",
    "title": "敌人被蕴种印标记"
   },
   {
    "field": "c2QSA",
    "title": "被蕴种印标记的敌人受到原激化、超激化、蔓激化反应影响"
   },
   {
    "field": "c4Count",
    "title": "附近处于所闻遍计的蕴种印状态下的敌人数量"
   },
   {
    "field": "partyInBurst",
    "title": "队伍在领域内"
   },
   {
    "field": "condA1ActiveInBurst",
    "title": "领域内的当前场上角色"
   }
  ]
 },
 "Nilou": {
  "name": "妮露",
  "element": "hydro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c4AfterPirHit",
    "title": "七域舞步的翩转状态下的第三段舞步命中敌人后"
   },
   {
    "field": "a1AfterSkill",
    "title": "金杯的丰馈状态下"
   },
   {
    "field": "a1AfterHit",
    "title": "处于金杯的丰馈状态下的角色受到草元素攻击后"
   },
   {
    "field": "c2Hydro",
    "title": "对敌水元素伤害攻击"
   },
   {
    "field": "c2Dendro",
    "title": "草元素伤害击中敌人"
   }
  ]
 },
 "Candace": {
  "name": "坎蒂丝",
  "element": "hydro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c2AfterSkillHit",
    "title": "元素战技命中敌人"
   },
   {
    "field": "afterBurst",
    "title": "使用元素爆发后"
   }
  ]
 },
 "Cyno": {
  "name": "赛诺",
  "element": "electro",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a1Judication",
    "title": "触发裁定效果后"
   },
   {
    "field": "afterBurst",
    "title": "处于启途誓使状态"
   },
   {
    "field": "lockRevelation",
    "title": "完成魔女的启示后"
   },
   {
    "field": "lockStellarRadianceSc",
    "title": "角色处于极星辉域内"
   },
   {
    "field": "c1Together",
    "title": "角色处于偕日共升效果下"
   },
   {
    "field": "c2NormHitStacks",
    "title": "普通攻击命中敌人"
   },
   {
    "field": "c2TeamHit",
    "title": "处于偕日共升效果下时，普通攻击或重击命中敌人后"
   }
  ]
 },
 "Dori": {
  "name": "多莉",
  "element": "electro",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "c6AfterSkill",
    "title": "使用元素战技后"
   },
   {
    "field": "c4BelowHp",
    "title": "角色与灯中幽精相连且生命值低于50%"
   },
   {
    "field": "c4BelowEner",
    "title": "角色与灯中幽精相连且元素能量低于50%"
   }
  ]
 },
 "Tighnari": {
  "name": "提纳里",
  "element": "dendro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "p1AfterWreath",
    "title": "发射花筥箭后"
   },
   {
    "field": "c2EnemyField",
    "title": "领域内的敌人"
   },
   {
    "field": "c4",
    "title": "触发条件"
   }
  ]
 },
 "Collei": {
  "name": "柯莱",
  "element": "dendro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "afterBurst",
    "title": "使用元素爆发后"
   },
   {
    "field": "offField",
    "title": "角色处于后台"
   }
  ]
 },
 "ShikanoinHeizou": {
  "name": "鹿野院平藏",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "declensionStacks",
    "title": "变格"
   },
   {
    "field": "skillHit",
    "title": "元素战技命中敌人"
   },
   {
    "field": "takeField",
    "title": "登场后"
   }
  ]
 },
 "KukiShinobu": {
  "name": "久岐忍",
  "element": "electro",
  "burst": false,
  "sustainedSkill": true,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "underHP",
    "title": "生命值低于或等于50%"
   },
   {
    "field": "c6Trigger",
    "title": "生命值低于25%"
   }
  ]
 },
 "Yelan": {
  "name": "夜兰",
  "element": "hydro",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c4Stacks",
    "title": "络命丝标记敌人数"
   },
   {
    "field": "a4Stacks",
    "title": "使用元素爆发后"
   }
  ]
 },
 "KamisatoAyato": {
  "name": "神里绫人",
  "element": "hydro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "skillStacks",
    "title": "浪闪层数"
   },
   {
    "field": "c1OppHp",
    "title": "敌人生命值低于或等于50%"
   },
   {
    "field": "burstInArea",
    "title": "领域内的当前场上角色"
   },
   {
    "field": "c4AfterBurst",
    "title": "使用元素爆发后"
   }
  ]
 },
 "YaeMiko": {
  "name": "八重神子",
  "element": "electro",
  "burst": false,
  "sustainedSkill": true,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c4",
    "title": "杀生樱的落雷命中敌人后"
   },
   {
    "field": "lockRevelation",
    "title": "完成魔女的启示后"
   },
   {
    "field": "lockStellarRadianceSc",
    "title": "角色处于极星辉域内"
   },
   {
    "field": "c1",
    "title": "触发超导或星超导反应，或造成星超导反应伤害后"
   },
   {
    "field": "c2",
    "title": "杀生樱位阶"
   }
  ]
 },
 "YunJin": {
  "name": "云堇",
  "element": "geo",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "skill",
    "title": "飞云旗阵"
   },
   {
    "field": "c4",
    "title": "触发结晶或月结晶反应后"
   }
  ]
 },
 "Shenhe": {
  "name": "申鹤",
  "element": "cryo",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "quill",
    "title": "附带冰翎效果"
   },
   {
    "field": "asc4",
    "title": "点按施放元素战技后"
   },
   {
    "field": "asc4Hold",
    "title": "长按施放元素战技后"
   },
   {
    "field": "c4",
    "title": "「霜霄诀」层数"
   },
   {
    "field": "burst",
    "title": "领域内的敌人"
   },
   {
    "field": "asc1",
    "title": "领域内的当前场上角色"
   }
  ]
 },
 "AratakiItto": {
  "name": "荒泷一斗",
  "element": "geo",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "passive1",
    "title": "荒泷一斗施展连续的「荒泷逆袈裟」"
   },
   {
    "field": "burst",
    "title": "使用元素爆发后"
   },
   {
    "field": "constellation4",
    "title": "最恶鬼王 • 一斗轰临！！施加的「怒目鬼王」状态结束后"
   }
  ]
 },
 "Gorou": {
  "name": "五郎",
  "element": "geo",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "inField",
    "title": "领域内的当前场上角色"
   },
   {
    "field": "afterBurst",
    "title": "使用元素爆发后"
   },
   {
    "field": "afterSkillBurst",
    "title": "释放元素战技或元素爆发后"
   }
  ]
 },
 "Thoma": {
  "name": "托马",
  "element": "pyro",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "p1BarrierStacks",
    "title": "获取或刷新烈烧佑命护盾后"
   },
   {
    "field": "c6AfterBarrier",
    "title": "获取或刷新烈烧佑命护盾后"
   }
  ]
 },
 "SangonomiyaKokomi": {
  "name": "珊瑚宫心海",
  "element": "hydro",
  "burst": true,
  "sustainedSkill": true,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "burst",
    "title": "仪来羽衣"
   },
   {
    "field": "c6",
    "title": "普通攻击和重击对生命值高于或等于80%的角色进行治疗时"
   },
   {
    "field": "c2",
    "title": "生命值低于或等于50%的角色"
   }
  ]
 },
 "Aloy": {
  "name": "埃洛伊",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "coil",
    "title": "线圈"
   },
   {
    "field": "A1",
    "title": "埃洛伊获得冰尘雪野的线圈效果时"
   },
   {
    "field": "A4",
    "title": "处于冰驰状态下（每秒1层）"
   }
  ]
 },
 "KujouSara": {
  "name": "九条裟罗",
  "element": "electro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "TenguJuuraiAmbush",
    "title": "天狗咒雷:伏"
   },
   {
    "field": "c6",
    "title": "处于天狗咒雷带来的攻击力提升效果状态下的角色"
   }
  ]
 },
 "RaidenShogun": {
  "name": "雷电将军",
  "element": "electro",
  "burst": true,
  "sustainedSkill": true,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "skillEye",
    "title": "雷罚恶曜之眼"
   },
   {
    "field": "skillEyeTeam",
    "title": "能量消耗"
   },
   {
    "field": "burstResolve",
    "title": "积攒愿力层数"
   },
   {
    "field": "InBurst",
    "title": "处于梦想一心状态"
   },
   {
    "field": "c4",
    "title": "奥义-梦想真说 施加的梦想一心 状态结束后"
   }
  ]
 },
 "Sayu": {
  "name": "早柚",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "skillAbsorption",
    "title": "元素转化"
   },
   {
    "field": "c2SkillStack",
    "title": "风风轮状态持续时间"
   }
  ]
 },
 "Yoimiya": {
  "name": "宵宫",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "skill",
    "title": "使用元素战技后"
   },
   {
    "field": "a1",
    "title": "袖火百景图"
   },
   {
    "field": "c1",
    "title": "攻击受 琉金火光影响的敌人"
   },
   {
    "field": "burst",
    "title": "使用元素爆发后"
   },
   {
    "field": "c2",
    "title": "火元素伤害造成暴击后"
   }
  ]
 },
 "KamisatoAyaka": {
  "name": "神里绫华",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "afterSkillA1",
    "title": "使用元素战技后"
   },
   {
    "field": "afterBurst",
    "title": "敌人受到神里流-霜灭的霜见雪关扉伤害后"
   },
   {
    "field": "afterSprint",
    "title": "冲刺后"
   },
   {
    "field": "afterApplySprint",
    "title": "冲刺后对敌人施加冰元素附着"
   },
   {
    "field": "C6",
    "title": "「薄冰舞踏」激活"
   }
  ]
 },
 "KaedeharaKazuha": {
  "name": "枫原万叶",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "skillAbsorption",
    "title": "元素转化"
   },
   {
    "field": "burstAbsorption",
    "title": "元素转化"
   },
   {
    "field": "c2",
    "title": "处于流风秋野领域中"
   },
   {
    "field": "c2p",
    "title": "领域内的当前场上角色"
   },
   {
    "field": "swirlhydro",
    "title": "触发水扩散反应"
   },
   {
    "field": "swirlpyro",
    "title": "触发火扩散反应"
   },
   {
    "field": "swirlcryo",
    "title": "触发冰扩散反应"
   },
   {
    "field": "swirlelectro",
    "title": "触发雷扩散反应"
   },
   {
    "field": "c6",
    "title": "使用千早振 或 万叶之一刀后"
   }
  ]
 },
 "Eula": {
  "name": "优菈",
  "element": "cryo",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "Grimheart",
    "title": "冷酷之心"
   },
   {
    "field": "grimheartConsumed",
    "title": "消耗冷酷之心层数"
   },
   {
    "field": "LightfallSword",
    "title": "光降之剑"
   },
   {
    "field": "LightfallSwordC4",
    "title": "敌人生命值低于50%"
   },
   {
    "field": "TidalIllusion",
    "title": "消耗冷酷之心层数"
   }
  ]
 },
 "Yanfei": {
  "name": "烟绯",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "p1Seals",
    "title": "每枚被重击消耗的丹火印"
   },
   {
    "field": "afterBurst",
    "title": "使用元素爆发后"
   },
   {
    "field": "c2EnemyHp",
    "title": "敌人生命值低于50%"
   }
  ]
 },
 "Rosaria": {
  "name": "罗莎莉亚",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "DilucC6",
    "title": "元素战技命中敌人"
   },
   {
    "field": "RosariaA1",
    "title": "背后攻击后"
   },
   {
    "field": "RosariaA4",
    "title": "使用元素爆发后"
   },
   {
    "field": "RosariaC1",
    "title": "命中敌人并造成暴击"
   }
  ]
 },
 "HuTao": {
  "name": "胡桃",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "GuideToAfterlifeVoyage",
    "title": "进入彼岸蝶舞状态"
   },
   {
    "field": "FlutterBy",
    "title": "蝶引来生施加的彼岸蝶舞状态结束后"
   },
   {
    "field": "SanguineRouge",
    "title": "生命值低于或等于50%"
   },
   {
    "field": "GardenOfEternalRest",
    "title": "处于胡桃自己施加的血梅香状态影响下的敌人被击败时"
   },
   {
    "field": "ButterflysEmbrace",
    "title": "生命值降至25%以下，或承受致命伤害时"
   }
  ]
 },
 "Xiao": {
  "name": "魈",
  "element": "anemo",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": true,
  "healer": false,
  "signals": [
   {
    "field": "a4SkillStack",
    "title": "风轮两立可使用次数"
   },
   {
    "field": "inBurst",
    "title": "处于夜叉傩面状态下"
   },
   {
    "field": "a1BurstStack",
    "title": "夜叉傩面持续时间"
   },
   {
    "field": "offField",
    "title": "角色处于后台"
   },
   {
    "field": "c4BelowHP",
    "title": "生命值低于50%"
   }
  ]
 },
 "Ganyu": {
  "name": "甘雨",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "A1",
    "title": "霜华矢发射后"
   },
   {
    "field": "C1",
    "title": "敌人被二段蓄力重击的霜华矢或霜华绽发命中"
   },
   {
    "field": "A4",
    "title": "领域内的当前场上角色"
   },
   {
    "field": "C4",
    "title": "领域内的敌人"
   }
  ]
 },
 "Albedo": {
  "name": "阿贝多",
  "element": "geo",
  "burst": false,
  "sustainedSkill": true,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "p1EnemyHp",
    "title": "敌人生命值低于50%"
   },
   {
    "field": "c1LockAfterSkill",
    "title": "使用元素战技后"
   },
   {
    "field": "skillInField",
    "title": "领域内的当前场上角色"
   },
   {
    "field": "c4LockAfterJump",
    "title": "附近当前场上角色在瑰银附近跳跃后"
   },
   {
    "field": "c6Crystallize",
    "title": "处于结晶护盾庇护下，或附近存在月结晶反应形成的月笼"
   },
   {
    "field": "burstUsed",
    "title": "使用元素爆发后"
   },
   {
    "field": "c2Stacks",
    "title": "清除的生灭计数层数"
   },
   {
    "field": "c6LockAfterDestroy",
    "title": "施放元素爆发并摧毁瑰银后"
   },
   {
    "field": "a1LockSilver",
    "title": "瑰银在场"
   },
   {
    "field": "lockHomework",
    "title": "完成魔女的课业后"
   },
   {
    "field": "lockCreateSolar",
    "title": "生成阳华后"
   },
   {
    "field": "lockCreateSilver",
    "title": "炼成瑰银后"
   }
  ]
 },
 "Xinyan": {
  "name": "辛焱",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c6Charged",
    "title": "释放重击时"
   },
   {
    "field": "p2Shield",
    "title": "处于热情拂扫r的护盾保护下的角色"
   },
   {
    "field": "c4Burst",
    "title": "热情拂扫的挥舞伤害命中敌人"
   },
   {
    "field": "c1Crit",
    "title": "命中敌人并造成暴击"
   }
  ]
 },
 "Zhongli": {
  "name": "钟离",
  "element": "geo",
  "burst": false,
  "sustainedSkill": true,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "skill",
    "title": "敌人处于玉璋护盾附近"
   },
   {
    "field": "p1",
    "title": "玉璋护盾受到伤害时"
   }
  ]
 },
 "Diona": {
  "name": "迪奥娜",
  "element": "cryo",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "Ascension1",
    "title": "处于猫爪冻冻的护盾保护下的角色"
   },
   {
    "field": "Constellation6",
    "title": "领域内的当前场上角色"
   },
   {
    "field": "lockRevelation",
    "title": "完成魔女的启示后"
   },
   {
    "field": "lockStellarRadianceSc",
    "title": "辉映状态"
   }
  ]
 },
 "Tartaglia": {
  "name": "达达利亚",
  "element": "hydro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": []
 },
 "Klee": {
  "name": "可莉",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "lockHomework",
    "title": "完成魔女的课业后"
   },
   {
    "field": "lockBadge",
    "title": "持有的轰轰勋章数量"
   },
   {
    "field": "lockC1",
    "title": "召唤火花后"
   },
   {
    "field": "ExplosiveFrags",
    "title": "受到蹦蹦炸弹的诡雷攻击的敌人"
   },
   {
    "field": "BlazingDelight",
    "title": "施放轰轰火花"
   }
  ]
 },
 "Venti": {
  "name": "温迪",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c2",
    "title": "眷恋的泠风"
   },
   {
    "field": "burstAbsorption",
    "title": "元素转化"
   },
   {
    "field": "c6",
    "title": "受 风神之诗伤害的敌人"
   },
   {
    "field": "lockHomework",
    "title": "完成魔女的课业后"
   },
   {
    "field": "lockBurstSwirl",
    "title": "暴风之眼存在时，附近当前场上角色触发扩散反应后"
   },
   {
    "field": "c4",
    "title": "获得元素晶球或元素微粒"
   },
   {
    "field": "lockC4SkillBurst",
    "title": "释放元素战技或元素爆发后"
   }
  ]
 },
 "TravelerAnemoF": {
  "name": "荧 (风)",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "skillAbsorption",
    "title": "元素转化"
   },
   {
    "field": "anemoBurstAbsorption",
    "title": "元素转化"
   },
   {
    "field": "anemoC6Hit",
    "title": "受到风息激荡伤害的目标"
   },
   {
    "field": "lockedPassive",
    "title": "完成对应魔神任务、解锁强化天赋后"
   },
   {
    "field": "traveleranemo",
    "title": "已与风元素共鸣"
   },
   {
    "field": "travelergeo",
    "title": "已与岩元素共鸣"
   },
   {
    "field": "travelerelectro",
    "title": "已与雷元素共鸣"
   },
   {
    "field": "travelerdendro",
    "title": "已与草元素共鸣"
   },
   {
    "field": "travelerhydro",
    "title": "已与水元素共鸣"
   },
   {
    "field": "travelerpyro",
    "title": "已与火元素共鸣"
   },
   {
    "field": "travelercryo",
    "title": "已与冰元素共鸣"
   },
   {
    "field": "bonusCanned",
    "title": "在魔神任务中使用罐装知识后"
   },
   {
    "field": "bonusSkirk1",
    "title": "完成丝柯克传说任务特训第2步后"
   },
   {
    "field": "bonusSkirk2",
    "title": "完成丝柯克传说任务特训第6步后"
   },
   {
    "field": "bonusSkirk3",
    "title": "完成丝柯克传说任务特训第9步后"
   }
  ]
 },
 "TravelerCryoF": {
  "name": "荧 (冰)",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "burstFrostglow",
    "title": "消耗的寒辉层数"
   },
   {
    "field": "a1ScStar",
    "title": "栗烈寒星在场"
   },
   {
    "field": "a0StellarRadiance",
    "title": "辉映状态"
   },
   {
    "field": "lockedPassive",
    "title": "完成对应魔神任务、解锁强化天赋后"
   },
   {
    "field": "traveleranemo",
    "title": "已与风元素共鸣"
   },
   {
    "field": "travelergeo",
    "title": "已与岩元素共鸣"
   },
   {
    "field": "travelerelectro",
    "title": "已与雷元素共鸣"
   },
   {
    "field": "travelerdendro",
    "title": "已与草元素共鸣"
   },
   {
    "field": "travelerhydro",
    "title": "已与水元素共鸣"
   },
   {
    "field": "travelerpyro",
    "title": "已与火元素共鸣"
   },
   {
    "field": "travelercryo",
    "title": "已与冰元素共鸣"
   },
   {
    "field": "c2Crystal",
    "title": "冰晶命中敌人后"
   },
   {
    "field": "c2ActiveStellar",
    "title": "角色触发星烁反应或造成星烁反应伤害"
   },
   {
    "field": "bonusCanned",
    "title": "在魔神任务中使用罐装知识后"
   },
   {
    "field": "bonusSkirk1",
    "title": "完成丝柯克传说任务特训第2步后"
   },
   {
    "field": "bonusSkirk2",
    "title": "完成丝柯克传说任务特训第6步后"
   },
   {
    "field": "bonusSkirk3",
    "title": "完成丝柯克传说任务特训第9步后"
   }
  ]
 },
 "TravelerDendroF": {
  "name": "荧 (草元素)",
  "element": "dendro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a1Stacks",
    "title": "层数"
   },
   {
    "field": "c6BurstEffect",
    "title": "领域内的当前场上角色"
   },
   {
    "field": "c6BurstEle",
    "title": "元素转化"
   },
   {
    "field": "lockedPassive",
    "title": "完成对应魔神任务、解锁强化天赋后"
   },
   {
    "field": "traveleranemo",
    "title": "已与风元素共鸣"
   },
   {
    "field": "travelergeo",
    "title": "已与岩元素共鸣"
   },
   {
    "field": "travelerelectro",
    "title": "已与雷元素共鸣"
   },
   {
    "field": "travelerdendro",
    "title": "已与草元素共鸣"
   },
   {
    "field": "travelerhydro",
    "title": "已与水元素共鸣"
   },
   {
    "field": "travelerpyro",
    "title": "已与火元素共鸣"
   },
   {
    "field": "travelercryo",
    "title": "已与冰元素共鸣"
   },
   {
    "field": "bonusCanned",
    "title": "在魔神任务中使用罐装知识后"
   },
   {
    "field": "bonusSkirk1",
    "title": "完成丝柯克传说任务特训第2步后"
   },
   {
    "field": "bonusSkirk2",
    "title": "完成丝柯克传说任务特训第6步后"
   },
   {
    "field": "bonusSkirk3",
    "title": "完成丝柯克传说任务特训第9步后"
   }
  ]
 },
 "TravelerElectroF": {
  "name": "荧 (雷)",
  "element": "electro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "electroSkillAmulet",
    "title": "角色吸收丰穰勾玉"
   },
   {
    "field": "electroC2Thunder",
    "title": "威光落雷命中敌人"
   },
   {
    "field": "lockedPassive",
    "title": "完成对应魔神任务、解锁强化天赋后"
   },
   {
    "field": "traveleranemo",
    "title": "已与风元素共鸣"
   },
   {
    "field": "travelergeo",
    "title": "已与岩元素共鸣"
   },
   {
    "field": "travelerelectro",
    "title": "已与雷元素共鸣"
   },
   {
    "field": "travelerdendro",
    "title": "已与草元素共鸣"
   },
   {
    "field": "travelerhydro",
    "title": "已与水元素共鸣"
   },
   {
    "field": "travelerpyro",
    "title": "已与火元素共鸣"
   },
   {
    "field": "travelercryo",
    "title": "已与冰元素共鸣"
   },
   {
    "field": "bonusCanned",
    "title": "在魔神任务中使用罐装知识后"
   },
   {
    "field": "bonusSkirk1",
    "title": "完成丝柯克传说任务特训第2步后"
   },
   {
    "field": "bonusSkirk2",
    "title": "完成丝柯克传说任务特训第6步后"
   },
   {
    "field": "bonusSkirk3",
    "title": "完成丝柯克传说任务特训第9步后"
   }
  ]
 },
 "TravelerGeoF": {
  "name": "荧 (岩元素)",
  "element": "geo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "geoC1BurstArea",
    "title": "领域内的当前场上角色"
   },
   {
    "field": "lockedPassive",
    "title": "完成对应魔神任务、解锁强化天赋后"
   },
   {
    "field": "traveleranemo",
    "title": "已与风元素共鸣"
   },
   {
    "field": "travelergeo",
    "title": "已与岩元素共鸣"
   },
   {
    "field": "travelerelectro",
    "title": "已与雷元素共鸣"
   },
   {
    "field": "travelerdendro",
    "title": "已与草元素共鸣"
   },
   {
    "field": "travelerhydro",
    "title": "已与水元素共鸣"
   },
   {
    "field": "travelerpyro",
    "title": "已与火元素共鸣"
   },
   {
    "field": "travelercryo",
    "title": "已与冰元素共鸣"
   },
   {
    "field": "lockedPassiveHit",
    "title": "攻击命中敌人"
   },
   {
    "field": "bonusCanned",
    "title": "在魔神任务中使用罐装知识后"
   },
   {
    "field": "bonusSkirk1",
    "title": "完成丝柯克传说任务特训第2步后"
   },
   {
    "field": "bonusSkirk2",
    "title": "完成丝柯克传说任务特训第6步后"
   },
   {
    "field": "bonusSkirk3",
    "title": "完成丝柯克传说任务特训第9步后"
   }
  ]
 },
 "TravelerHydroF": {
  "name": "荧 (水元素)",
  "element": "hydro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "suffusion",
    "title": "处于充盈状态"
   },
   {
    "field": "a4HpConsumedPercent",
    "title": "充盈消耗的生命值上限百分比"
   },
   {
    "field": "lockedPassive",
    "title": "完成对应魔神任务、解锁强化天赋后"
   },
   {
    "field": "traveleranemo",
    "title": "已与风元素共鸣"
   },
   {
    "field": "travelergeo",
    "title": "已与岩元素共鸣"
   },
   {
    "field": "travelerelectro",
    "title": "已与雷元素共鸣"
   },
   {
    "field": "travelerdendro",
    "title": "已与草元素共鸣"
   },
   {
    "field": "travelerhydro",
    "title": "已与水元素共鸣"
   },
   {
    "field": "travelerpyro",
    "title": "已与火元素共鸣"
   },
   {
    "field": "travelercryo",
    "title": "已与冰元素共鸣"
   },
   {
    "field": "lockedPassiveHp",
    "title": "消耗的生命值"
   },
   {
    "field": "bonusCanned",
    "title": "在魔神任务中使用罐装知识后"
   },
   {
    "field": "bonusSkirk1",
    "title": "完成丝柯克传说任务特训第2步后"
   },
   {
    "field": "bonusSkirk2",
    "title": "完成丝柯克传说任务特训第6步后"
   },
   {
    "field": "bonusSkirk3",
    "title": "完成丝柯克传说任务特训第9步后"
   }
  ]
 },
 "TravelerPyroF": {
  "name": "荧 (火)",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": true,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c1SkillActive",
    "title": "焰烈之槛或灼火之槛已生效"
   },
   {
    "field": "c1Ns",
    "title": "处于夜魂加持状态"
   },
   {
    "field": "c4AfterBurst",
    "title": "使用元素爆发后"
   },
   {
    "field": "lockedPassive",
    "title": "完成对应魔神任务、解锁强化天赋后"
   },
   {
    "field": "traveleranemo",
    "title": "已与风元素共鸣"
   },
   {
    "field": "travelergeo",
    "title": "已与岩元素共鸣"
   },
   {
    "field": "travelerelectro",
    "title": "已与雷元素共鸣"
   },
   {
    "field": "travelerdendro",
    "title": "已与草元素共鸣"
   },
   {
    "field": "travelerhydro",
    "title": "已与水元素共鸣"
   },
   {
    "field": "travelerpyro",
    "title": "已与火元素共鸣"
   },
   {
    "field": "travelercryo",
    "title": "已与冰元素共鸣"
   },
   {
    "field": "c6InNs",
    "title": "处于夜魂加持状态"
   },
   {
    "field": "bonusCanned",
    "title": "在魔神任务中使用罐装知识后"
   },
   {
    "field": "bonusSkirk1",
    "title": "完成丝柯克传说任务特训第2步后"
   },
   {
    "field": "bonusSkirk2",
    "title": "完成丝柯克传说任务特训第6步后"
   },
   {
    "field": "bonusSkirk3",
    "title": "完成丝柯克传说任务特训第9步后"
   }
  ]
 },
 "TravelerAnemoM": {
  "name": "空 (风)",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "skillAbsorption",
    "title": "元素转化"
   },
   {
    "field": "anemoBurstAbsorption",
    "title": "元素转化"
   },
   {
    "field": "anemoC6Hit",
    "title": "受到风息激荡伤害的目标"
   },
   {
    "field": "lockedPassive",
    "title": "完成对应魔神任务、解锁强化天赋后"
   },
   {
    "field": "traveleranemo",
    "title": "已与风元素共鸣"
   },
   {
    "field": "travelergeo",
    "title": "已与岩元素共鸣"
   },
   {
    "field": "travelerelectro",
    "title": "已与雷元素共鸣"
   },
   {
    "field": "travelerdendro",
    "title": "已与草元素共鸣"
   },
   {
    "field": "travelerhydro",
    "title": "已与水元素共鸣"
   },
   {
    "field": "travelerpyro",
    "title": "已与火元素共鸣"
   },
   {
    "field": "travelercryo",
    "title": "已与冰元素共鸣"
   },
   {
    "field": "bonusCanned",
    "title": "在魔神任务中使用罐装知识后"
   },
   {
    "field": "bonusSkirk1",
    "title": "完成丝柯克传说任务特训第2步后"
   },
   {
    "field": "bonusSkirk2",
    "title": "完成丝柯克传说任务特训第6步后"
   },
   {
    "field": "bonusSkirk3",
    "title": "完成丝柯克传说任务特训第9步后"
   }
  ]
 },
 "TravelerCryoM": {
  "name": "空 (冰)",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "burstFrostglow",
    "title": "消耗的寒辉层数"
   },
   {
    "field": "a1ScStar",
    "title": "栗烈寒星在场"
   },
   {
    "field": "a0StellarRadiance",
    "title": "辉映状态"
   },
   {
    "field": "lockedPassive",
    "title": "完成对应魔神任务、解锁强化天赋后"
   },
   {
    "field": "traveleranemo",
    "title": "已与风元素共鸣"
   },
   {
    "field": "travelergeo",
    "title": "已与岩元素共鸣"
   },
   {
    "field": "travelerelectro",
    "title": "已与雷元素共鸣"
   },
   {
    "field": "travelerdendro",
    "title": "已与草元素共鸣"
   },
   {
    "field": "travelerhydro",
    "title": "已与水元素共鸣"
   },
   {
    "field": "travelerpyro",
    "title": "已与火元素共鸣"
   },
   {
    "field": "travelercryo",
    "title": "已与冰元素共鸣"
   },
   {
    "field": "c2Crystal",
    "title": "冰晶命中敌人后"
   },
   {
    "field": "c2ActiveStellar",
    "title": "角色触发星烁反应或造成星烁反应伤害"
   },
   {
    "field": "bonusCanned",
    "title": "在魔神任务中使用罐装知识后"
   },
   {
    "field": "bonusSkirk1",
    "title": "完成丝柯克传说任务特训第2步后"
   },
   {
    "field": "bonusSkirk2",
    "title": "完成丝柯克传说任务特训第6步后"
   },
   {
    "field": "bonusSkirk3",
    "title": "完成丝柯克传说任务特训第9步后"
   }
  ]
 },
 "TravelerDendroM": {
  "name": "空 (草元素)",
  "element": "dendro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "a1Stacks",
    "title": "层数"
   },
   {
    "field": "c6BurstEffect",
    "title": "领域内的当前场上角色"
   },
   {
    "field": "c6BurstEle",
    "title": "元素转化"
   },
   {
    "field": "lockedPassive",
    "title": "完成对应魔神任务、解锁强化天赋后"
   },
   {
    "field": "traveleranemo",
    "title": "已与风元素共鸣"
   },
   {
    "field": "travelergeo",
    "title": "已与岩元素共鸣"
   },
   {
    "field": "travelerelectro",
    "title": "已与雷元素共鸣"
   },
   {
    "field": "travelerdendro",
    "title": "已与草元素共鸣"
   },
   {
    "field": "travelerhydro",
    "title": "已与水元素共鸣"
   },
   {
    "field": "travelerpyro",
    "title": "已与火元素共鸣"
   },
   {
    "field": "travelercryo",
    "title": "已与冰元素共鸣"
   },
   {
    "field": "bonusCanned",
    "title": "在魔神任务中使用罐装知识后"
   },
   {
    "field": "bonusSkirk1",
    "title": "完成丝柯克传说任务特训第2步后"
   },
   {
    "field": "bonusSkirk2",
    "title": "完成丝柯克传说任务特训第6步后"
   },
   {
    "field": "bonusSkirk3",
    "title": "完成丝柯克传说任务特训第9步后"
   }
  ]
 },
 "TravelerElectroM": {
  "name": "空 (雷)",
  "element": "electro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "electroSkillAmulet",
    "title": "角色吸收丰穰勾玉"
   },
   {
    "field": "electroC2Thunder",
    "title": "威光落雷命中敌人"
   },
   {
    "field": "lockedPassive",
    "title": "完成对应魔神任务、解锁强化天赋后"
   },
   {
    "field": "traveleranemo",
    "title": "已与风元素共鸣"
   },
   {
    "field": "travelergeo",
    "title": "已与岩元素共鸣"
   },
   {
    "field": "travelerelectro",
    "title": "已与雷元素共鸣"
   },
   {
    "field": "travelerdendro",
    "title": "已与草元素共鸣"
   },
   {
    "field": "travelerhydro",
    "title": "已与水元素共鸣"
   },
   {
    "field": "travelerpyro",
    "title": "已与火元素共鸣"
   },
   {
    "field": "travelercryo",
    "title": "已与冰元素共鸣"
   },
   {
    "field": "bonusCanned",
    "title": "在魔神任务中使用罐装知识后"
   },
   {
    "field": "bonusSkirk1",
    "title": "完成丝柯克传说任务特训第2步后"
   },
   {
    "field": "bonusSkirk2",
    "title": "完成丝柯克传说任务特训第6步后"
   },
   {
    "field": "bonusSkirk3",
    "title": "完成丝柯克传说任务特训第9步后"
   }
  ]
 },
 "TravelerGeoM": {
  "name": "空 (岩元素)",
  "element": "geo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "geoC1BurstArea",
    "title": "领域内的当前场上角色"
   },
   {
    "field": "lockedPassive",
    "title": "完成对应魔神任务、解锁强化天赋后"
   },
   {
    "field": "traveleranemo",
    "title": "已与风元素共鸣"
   },
   {
    "field": "travelergeo",
    "title": "已与岩元素共鸣"
   },
   {
    "field": "travelerelectro",
    "title": "已与雷元素共鸣"
   },
   {
    "field": "travelerdendro",
    "title": "已与草元素共鸣"
   },
   {
    "field": "travelerhydro",
    "title": "已与水元素共鸣"
   },
   {
    "field": "travelerpyro",
    "title": "已与火元素共鸣"
   },
   {
    "field": "travelercryo",
    "title": "已与冰元素共鸣"
   },
   {
    "field": "lockedPassiveHit",
    "title": "攻击命中敌人"
   },
   {
    "field": "bonusCanned",
    "title": "在魔神任务中使用罐装知识后"
   },
   {
    "field": "bonusSkirk1",
    "title": "完成丝柯克传说任务特训第2步后"
   },
   {
    "field": "bonusSkirk2",
    "title": "完成丝柯克传说任务特训第6步后"
   },
   {
    "field": "bonusSkirk3",
    "title": "完成丝柯克传说任务特训第9步后"
   }
  ]
 },
 "TravelerHydroM": {
  "name": "空 (水元素)",
  "element": "hydro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "suffusion",
    "title": "处于充盈状态"
   },
   {
    "field": "a4HpConsumedPercent",
    "title": "充盈消耗的生命值上限百分比"
   },
   {
    "field": "lockedPassive",
    "title": "完成对应魔神任务、解锁强化天赋后"
   },
   {
    "field": "traveleranemo",
    "title": "已与风元素共鸣"
   },
   {
    "field": "travelergeo",
    "title": "已与岩元素共鸣"
   },
   {
    "field": "travelerelectro",
    "title": "已与雷元素共鸣"
   },
   {
    "field": "travelerdendro",
    "title": "已与草元素共鸣"
   },
   {
    "field": "travelerhydro",
    "title": "已与水元素共鸣"
   },
   {
    "field": "travelerpyro",
    "title": "已与火元素共鸣"
   },
   {
    "field": "travelercryo",
    "title": "已与冰元素共鸣"
   },
   {
    "field": "lockedPassiveHp",
    "title": "消耗的生命值"
   },
   {
    "field": "bonusCanned",
    "title": "在魔神任务中使用罐装知识后"
   },
   {
    "field": "bonusSkirk1",
    "title": "完成丝柯克传说任务特训第2步后"
   },
   {
    "field": "bonusSkirk2",
    "title": "完成丝柯克传说任务特训第6步后"
   },
   {
    "field": "bonusSkirk3",
    "title": "完成丝柯克传说任务特训第9步后"
   }
  ]
 },
 "TravelerPyroM": {
  "name": "空 (火)",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": true,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "c1SkillActive",
    "title": "焰烈之槛或灼火之槛已生效"
   },
   {
    "field": "c1Ns",
    "title": "处于夜魂加持状态"
   },
   {
    "field": "c4AfterBurst",
    "title": "使用元素爆发后"
   },
   {
    "field": "lockedPassive",
    "title": "完成对应魔神任务、解锁强化天赋后"
   },
   {
    "field": "traveleranemo",
    "title": "已与风元素共鸣"
   },
   {
    "field": "travelergeo",
    "title": "已与岩元素共鸣"
   },
   {
    "field": "travelerelectro",
    "title": "已与雷元素共鸣"
   },
   {
    "field": "travelerdendro",
    "title": "已与草元素共鸣"
   },
   {
    "field": "travelerhydro",
    "title": "已与水元素共鸣"
   },
   {
    "field": "travelerpyro",
    "title": "已与火元素共鸣"
   },
   {
    "field": "travelercryo",
    "title": "已与冰元素共鸣"
   },
   {
    "field": "c6InNs",
    "title": "处于夜魂加持状态"
   },
   {
    "field": "bonusCanned",
    "title": "在魔神任务中使用罐装知识后"
   },
   {
    "field": "bonusSkirk1",
    "title": "完成丝柯克传说任务特训第2步后"
   },
   {
    "field": "bonusSkirk2",
    "title": "完成丝柯克传说任务特训第6步后"
   },
   {
    "field": "bonusSkirk3",
    "title": "完成丝柯克传说任务特训第9步后"
   }
  ]
 },
 "Sucrose": {
  "name": "砂糖",
  "element": "anemo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "absorption",
    "title": "元素转化"
   },
   {
    "field": "swirlhydro",
    "title": "触发水扩散反应"
   },
   {
    "field": "swirlpyro",
    "title": "触发火扩散反应"
   },
   {
    "field": "swirlcryo",
    "title": "触发冰扩散反应"
   },
   {
    "field": "swirlelectro",
    "title": "触发雷扩散反应"
   },
   {
    "field": "skillHit",
    "title": "元素战技或元素爆发命中敌人"
   },
   {
    "field": "lockHomework",
    "title": "完成魔女的课业后"
   },
   {
    "field": "lockAfterSkill",
    "title": "使用元素战技后"
   },
   {
    "field": "lockAfterBurst",
    "title": "使用元素爆发后"
   }
  ]
 },
 "Keqing": {
  "name": "刻晴",
  "element": "electro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "afterRecast",
    "title": "再次施放星斗归位后"
   },
   {
    "field": "afterBurst",
    "title": "使用元素爆发后"
   },
   {
    "field": "afterReact",
    "title": "触发雷元素相关反应后"
   },
   {
    "field": "c6Stack",
    "title": "普通攻击、重击、元素战技或元素爆发命中敌人后"
   }
  ]
 },
 "Mona": {
  "name": "莫娜",
  "element": "hydro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "Omen",
    "title": "星异"
   },
   {
    "field": "lockHomework",
    "title": "完成魔女的课业后"
   },
   {
    "field": "lockStacks",
    "title": "水星天的辉光层数"
   },
   {
    "field": "ProphecyOfSubmersion",
    "title": "队伍中自己的角色攻击命中处于星异状态下的敌人"
   },
   {
    "field": "lockC2Charged",
    "title": "重击命中敌人"
   },
   {
    "field": "RhetoricsOfCalamitas",
    "title": "进入虚实流动状态后"
   }
  ]
 },
 "Chongyun": {
  "name": "重云",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "skill",
    "title": "领域内的当前场上角色"
   },
   {
    "field": "asc4",
    "title": "敌人被追冰剑诀的灵刃命中"
   },
   {
    "field": "c6",
    "title": "生命值百分比低于重云的敌人"
   }
  ]
 },
 "Qiqi": {
  "name": "七七",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "QiqiA1",
    "title": "处于仙法 • 寒病鬼差状态下的角色触发元素反应"
   },
   {
    "field": "lockRevelation",
    "title": "完成魔女的启示后"
   },
   {
    "field": "lockStellarRadianceSc",
    "title": "辉映状态"
   },
   {
    "field": "QiqiLk",
    "title": "寒病鬼差在场"
   },
   {
    "field": "QiqiC2",
    "title": "敌人处于冰元素影响下"
   },
   {
    "field": "QiqiC6",
    "title": "当前场上角色消耗洞玄后"
   }
  ]
 },
 "Noelle": {
  "name": "诺艾尔",
  "element": "geo",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "SweepingTime",
    "title": "大扫除"
   }
  ]
 },
 "Bennett": {
  "name": "班尼特",
  "element": "pyro",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "activeInArea",
    "title": "领域内的当前场上角色"
   },
   {
    "field": "underHP",
    "title": "生命值低于70%"
   }
  ]
 },
 "Fischl": {
  "name": "菲谢尔",
  "element": "electro",
  "burst": false,
  "sustainedSkill": true,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "lockHomework",
    "title": "完成魔女的课业后"
   },
   {
    "field": "lockOverload",
    "title": "队伍角色触发超载反应后"
   },
   {
    "field": "lockEcLc",
    "title": "队伍角色触发感电或月感电反应后"
   },
   {
    "field": "lockC6Oz",
    "title": "奥兹进行协同攻击后"
   }
  ]
 },
 "Ningguang": {
  "name": "凝光",
  "element": "geo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "Ascension4",
    "title": "穿过璇玑屏"
   },
   {
    "field": "Constellation4",
    "title": "距离璇玑屏10米内的角色"
   }
  ]
 },
 "Xingqiu": {
  "name": "行秋",
  "element": "hydro",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "skill",
    "title": "雨帘剑破碎"
   },
   {
    "field": "burst",
    "title": "裁雨留虹"
   },
   {
    "field": "c2",
    "title": "受到剑雨攻击的敌人"
   }
  ]
 },
 "Beidou": {
  "name": "北斗",
  "element": "electro",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "Ascension4",
    "title": "施放拥有最高伤害加成的捉浪"
   },
   {
    "field": "burst",
    "title": "斫雷持续期间"
   },
   {
    "field": "lockRevelation",
    "title": "完成魔女的启示后"
   },
   {
    "field": "lockStellarRadianceSc",
    "title": "角色处于极星辉域内"
   }
  ]
 },
 "Xiangling": {
  "name": "香菱",
  "element": "pyro",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "afterChili",
    "title": "拾取辣椒后"
   },
   {
    "field": "afterGuobaHit",
    "title": "受到锅巴攻击的敌人"
   },
   {
    "field": "afterPyronado",
    "title": "旋火轮持续期间"
   }
  ]
 },
 "Amber": {
  "name": "安柏",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "C6",
    "title": "使用箭雨"
   },
   {
    "field": "A4",
    "title": "重击命中敌人弱点后"
   }
  ]
 },
 "Razor": {
  "name": "雷泽",
  "element": "electro",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "ElectroSigil",
    "title": "雷之印"
   },
   {
    "field": "TheWolfWithin",
    "title": "雷狼"
   },
   {
    "field": "A4",
    "title": "敌人生命值低于50%"
   },
   {
    "field": "lockHomework",
    "title": "完成魔女的课业后"
   },
   {
    "field": "C1",
    "title": "获得元素晶球或元素微粒"
   },
   {
    "field": "C2",
    "title": "敌人生命值低于30%"
   },
   {
    "field": "C4",
    "title": "被利爪与苍雷点按命中的敌人"
   },
   {
    "field": "lockC6Sigil",
    "title": "消耗雷之印后"
   }
  ]
 },
 "Diluc": {
  "name": "迪卢克",
  "element": "pyro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "DilucC6",
    "title": "使用元素战技后"
   },
   {
    "field": "Burst",
    "title": "使用元素爆发后"
   },
   {
    "field": "DilucC1",
    "title": "敌人生命值高于50%"
   },
   {
    "field": "DilucC2",
    "title": "受到敌人攻击后"
   }
  ]
 },
 "Kaeya": {
  "name": "凯亚",
  "element": "cryo",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "CryoC1",
    "title": "敌人处于冰元素影响下"
   }
  ]
 },
 "Barbara": {
  "name": "芭芭拉",
  "element": "hydro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "skill",
    "title": "在演唱，开始♪的歌声之环中"
   },
   {
    "field": "c2",
    "title": "演唱，开始♪的持续期间"
   }
  ]
 },
 "Lisa": {
  "name": "丽莎",
  "element": "electro",
  "burst": false,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": false,
  "signals": [
   {
    "field": "LisaA4",
    "title": "受到蔷薇的雷光攻击"
   },
   {
    "field": "LisaC2",
    "title": "苍雷长按"
   }
  ]
 },
 "Jean": {
  "name": "琴",
  "element": "anemo",
  "burst": true,
  "sustainedSkill": false,
  "nightSoul": false,
  "hpCycle": false,
  "healer": true,
  "signals": [
   {
    "field": "c1",
    "title": "风压剑长按超过1秒"
   },
   {
    "field": "c4",
    "title": "领域内的敌人"
   },
   {
    "field": "c6",
    "title": "领域内的当前场上角色"
   },
   {
    "field": "c2",
    "title": "获得元素晶球或元素微粒"
   }
  ]
 }
};
