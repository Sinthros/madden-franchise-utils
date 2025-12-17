const FranchiseUtils = require("../Utils/FranchiseUtils");
const { tables } = require("../Utils/FranchiseTableId");
const { getBinaryReferenceData } = require("madden-franchise/services/utilService");
const fs = require("fs");

const signatureAbilities = {
    WRSignatureAbilities: {},
    TESignatureAbilities: {},
    QBSignatureAbilities: {},
    OLSignatureAbilities: {},
    OLBSignatureAbilities: {},
    MLBSignatureAbilities: {},
    K_PSignatureAbilities: {},
    HBSignatureAbilities: {},
    FS_SSSignatureAbilities: {},
    FBSignatureAbilities: {},
    DTSignatureAbilities: {},
    DESignatureAbilities: {},
    CBSignatureAbilities: {},
};

const gameYear = FranchiseUtils.YEARS.M26;
const franchise = FranchiseUtils.init(gameYear, { isFtcFile: true, promptForBackup: false });

function writeJSON(data, file) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

franchise.on("ready", async function () {
  const SignatureAbilitiesTable = franchise.getTableByUniqueId(tables.signatureAbilitesFtcTable);
  const SignatureByPosition = franchise.getTableByUniqueId(tables.signatureByPositionFtcTable);
  const PositionSignatureAbilityArray = franchise.getTableByUniqueId(3517346360);
  const PositionSignatureAbility = franchise.getTableByUniqueId(tables.positionSignatureAbilityFtcTable);
  const SignatureAbility = franchise.getTableByUniqueId(tables.signatureAbilityFtcTable);

  const tableId = PositionSignatureAbility.header.tableId;

  await FranchiseUtils.readTableRecords([
    SignatureAbilitiesTable,
    SignatureByPosition,
    PositionSignatureAbilityArray,
    PositionSignatureAbility,
    SignatureAbility,
  ]);

  const allAssets = franchise.assetTable;

  // -----------------------
  // Extract ability indices
  // -----------------------
  function extractAbilityIndices(arrayTable, abilityTable, binValue, capacity) {
    const out = [];
    if (binValue === FranchiseUtils.ZERO_REF) return out;

    const rowRef = FranchiseUtils.bin2Dec(binValue.slice(15));
    const row = arrayTable.records[rowRef];

    for (let i = 0; i < capacity; i++) {
      const abilityBin = row[`PositionSignatureAbility${i}`];
      if (abilityBin === FranchiseUtils.ZERO_REF) continue;

      const posAbilityRow = FranchiseUtils.bin2Dec(abilityBin.slice(15));
      const abilityBinRef = abilityTable.records[posAbilityRow]["Ability"];
      const abilityRow = FranchiseUtils.bin2Dec(abilityBinRef.slice(15));

      out.push({ posAbilityRow, abilityRow });
    }
    return out;
  }

  // ----------------------------------------
  // Build legacy structure with new fields
  // ----------------------------------------
  for (const key in signatureAbilities) {
    const colBinary = SignatureAbilitiesTable.records[0][key];
    const sigRowRef = FranchiseUtils.bin2Dec(colBinary.slice(15));
    const sigRow = SignatureByPosition.records[sigRowRef];

    const active = extractAbilityIndices(
      PositionSignatureAbilityArray,
      PositionSignatureAbility,
      sigRow["ActiveSignatures"],
      PositionSignatureAbilityArray.header.recordCapacity
    );

    const passive = extractAbilityIndices(
      PositionSignatureAbilityArray,
      PositionSignatureAbility,
      sigRow["PassiveSignatures"],
      PositionSignatureAbilityArray.header.numMembers
    );

    const xFactorRows = active.map(a => a.abilityRow);

    signatureAbilities[key].XFactorAbilities = [];
    signatureAbilities[key].SuperStarAbilities = [];

    const allAbilities = [...active, ...passive];

    for (const { posAbilityRow, abilityRow } of allAbilities) {
      const ability = SignatureAbility.records[abilityRow];
      if (!ability?.Name || ability.Name.trim() === "") continue;

      const abilityType =
        xFactorRows.includes(abilityRow) ? "XFactorAbilities" : "SuperStarAbilities";

      const posAbilityRecord = PositionSignatureAbility.records[posAbilityRow];

      const binRef = getBinaryReferenceData(tableId, posAbilityRow);
      const assetRef = FranchiseUtils.bin2Dec(binRef);

      const assetId = allAssets.find(a => a.reference === assetRef)?.assetId;
      const finalBin = FranchiseUtils.dec2bin(assetId, 2);
      if (ability.Name.trim() !== "") {
        signatureAbilities[key][abilityType].push({
          Ability: ability.Name,
          GUID: ability.GUID,
          Description: ability.Description,

          // Original fields
          binaryReference: finalBin,
          assetId,
          assetBinReference: assetRef,

          // NEW fields
          Disable: posAbilityRecord?.Disable ?? null,
          ArchetypeRequirement: posAbilityRecord?.ArchetypeRequirement ?? null,
          MaxSlotPosition: posAbilityRecord?.MaxSlotPosition ?? null,
          MinSlotPosition: posAbilityRecord?.MinSlotPosition ?? null,
          OVRRequirement: posAbilityRecord?.OVRRequirement ?? null,
          DraftPositionRequirement: posAbilityRecord?.DraftPositionRequirement ?? null,
          IconId: ability.IconId,
        });
      }
    }
  }

  writeJSON(signatureAbilities, "abilities.json");
});
