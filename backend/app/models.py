"""FLAMEPRINT data contract (mirrors frontend/src/lib/types.ts).

Two levels of data:
  * Investigation - one PSI investigation (BASS, FLEX, ...). Seeded from a curated catalog
    (data/seed) and overridable by imported metadata.
  * TestRecord    - one test / run / data point from a PSI dataset. These ONLY come from
    imported files. FLAMEPRINT never fabricates them.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

FuelPhase = Literal["solid", "liquid", "gas"]
Pillar = Literal["prevention", "detection", "suppression"]
Confidence = Literal["data", "approx", "unknown"]
Outcome = Literal["burned", "extinguished", "no-ignition", "unknown"]

Range = tuple[float, float]


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class Pillars(CamelModel):
    prevention: float = 0.0
    detection: float = 0.0
    suppression: float = 0.0


class ConditionEnvelope(CamelModel):
    o2Pct: Optional[Range] = None
    pressureKpa: Optional[Range] = None
    flowCmS: Optional[Range] = None
    confidence: Confidence = "unknown"
    note: Optional[str] = None


class Investigation(CamelModel):
    id: str
    name: str
    project: Optional[str] = None
    facility: str = "Unknown"
    apparatus: Optional[str] = None
    platform: str = "ISS"
    fuelPhase: list[FuelPhase] = Field(default_factory=list)
    fuels: list[str] = Field(default_factory=list)
    geometry: str = ""
    objective: str = ""
    pillars: Pillars = Field(default_factory=Pillars)
    conditions: ConditionEnvelope = Field(default_factory=ConditionEnvelope)
    diluents: list[str] = Field(default_factory=list)
    measurements: list[str] = Field(default_factory=list)
    insights: dict[str, str] = Field(default_factory=dict)
    earthApplications: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    status: Literal["in-psi", "pending"] = "in-psi"
    provenance: str = "Imported"


class TestRecord(CamelModel):
    __test__ = False  # not a pytest class

    id: str
    investigationId: str
    o2Pct: Optional[float] = None
    pressureKpa: Optional[float] = None
    flowCmS: Optional[float] = None
    gravityG: Optional[float] = None
    fuel: Optional[str] = None
    diluent: Optional[str] = None
    outcome: Optional[Outcome] = None
    metricName: Optional[str] = None
    metricValue: Optional[float] = None
    source: str
    raw: dict = Field(default_factory=dict)


class Relation(CamelModel):
    from_: str = Field(alias="from")
    to: str
    type: str
    note: str = ""


class Spinoff(CamelModel):
    title: str
    text: str
    pillar: Pillar
    related: list[str] = Field(default_factory=list)
    basis: str


class DataSource(CamelModel):
    name: str
    origin: Literal["seed", "server", "upload"]
    kind: Literal["investigations", "tests", "document"]
    count: int
    warnings: list[str] = Field(default_factory=list)


class OxygenThreshold(CamelModel):
    o2Pct: Optional[float] = None
    basis: str = ""
    source: Optional[str] = None
    url: Optional[str] = None


class Material(CamelModel):
    id: str
    name: str
    usedFor: str = ""
    phase: FuelPhase = "solid"
    aliases: list[str] = Field(default_factory=list)
    testedIn: list[str] = Field(default_factory=list)
    testedInBasis: Optional[str] = None
    oxygenThreshold: OxygenThreshold = Field(default_factory=OxygenThreshold)
    notes: str = ""


GradeLetter = Literal["A", "B", "C", "M"]


class Grade(CamelModel):
    letter: GradeLetter
    reason: str
    basis: list[str] = Field(default_factory=list)


RiskLevel = Literal["high", "elevated", "low", "unknown"]


class MaterialVerdict(CamelModel):
    id: str
    name: str
    usedFor: str = ""
    level: RiskLevel
    margin: Optional[float] = None
    threshold1g: Optional[float] = None
    effectiveThreshold: Optional[float] = None
    grade: Grade
    label: str = "illustrative model"
    why: str
    source: Optional[str] = None
    url: Optional[str] = None


class Dataset(CamelModel):
    investigations: list[Investigation]
    tests: list[TestRecord]
    materials: list[Material] = Field(default_factory=list)
    relations: list[Relation] = Field(default_factory=list)
    spinoffs: list[Spinoff] = Field(default_factory=list)
    sources: list[DataSource] = Field(default_factory=list)

    def inv(self, inv_id: str) -> Optional[Investigation]:
        return next((i for i in self.investigations if i.id == inv_id), None)


class Scenario(CamelModel):
    habitatId: str = "custom"
    o2Pct: float = Field(21.0, ge=0, le=100)
    pressureKpa: float = Field(101.3, ge=0, le=1000)
    flowCmS: float = Field(10.0, ge=0, le=500)
    gravityG: float = Field(0.0, ge=0, le=3)
    phases: list[FuelPhase] = Field(default_factory=lambda: ["solid"])
    pillarFocus: Pillars = Field(default_factory=lambda: Pillars(prevention=1, detection=1, suppression=1))


class Weights(CamelModel):
    o2: float = Field(0.25, ge=0)
    pressure: float = Field(0.15, ge=0)
    flow: float = Field(0.15, ge=0)
    material: float = Field(0.20, ge=0)
    pillar: float = Field(0.20, ge=0)
    gravity: float = Field(0.05, ge=0)


class FactorScore(CamelModel):
    key: str
    label: str
    score: float
    weight: float
    why: str
    confidence: Confidence


class RankedInvestigation(CamelModel):
    id: str
    name: str
    score: float
    grade: Optional["Grade"] = None
    factors: list[FactorScore]
    nearbyTests: int
    totalTests: int
    envelope: ConditionEnvelope


class Gap(CamelModel):
    severity: Literal["critical", "high", "medium", "info"]
    title: str
    detail: str


class RankRequest(CamelModel):
    scenario: Scenario = Field(default_factory=Scenario)
    weights: Weights = Field(default_factory=Weights)


class AskRequest(CamelModel):
    question: str = Field(min_length=2, max_length=2000)
    scenario: Optional[Scenario] = None


class StowageRequest(CamelModel):
    item: str = Field(min_length=1, max_length=200)
    scenario: Scenario = Field(default_factory=Scenario)


class CompareHabitatsRequest(CamelModel):
    a: Scenario
    b: Scenario
    weights: Weights = Field(default_factory=Weights)
