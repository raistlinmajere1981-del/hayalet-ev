import { createEmptyState } from "../../rooms/pattern-room/ui/panels/pattern-panel-utils.ts";
import { startPatternRoomInstalledUi } from "./pattern-room-installed-ui-smoke.helpers.ts";
import {
  assert,
  createMinimalForgeUiEnvironment,
  createRoomInstalledCopy,
  fireEvent,
  test,
} from "./forge-room-ui-smoke.helpers.ts";

void test("pattern-room shared empty state preserves message and semantics", () => {
  const environment = createMinimalForgeUiEnvironment();

  try {
    const pending = createEmptyState("İnceleme yanıtı bekleniyor.", "pending", {
      compact: true,
      live: true,
    });

    assert.equal(pending.textContent, "İnceleme yanıtı bekleniyor.");
    assert.equal(pending.dataset["patternEmptyState"], "true");
    assert.equal(pending.dataset["patternEmptyStateKind"], "pending");
    assert.equal(pending.classList.contains("compact"), true);
    assert.equal(pending.role, "status");
    assert.equal(pending.ariaLive, "polite");
  } finally {
    environment.restore();
  }
});

void test("pattern-room UI revision keeps archive detail in the persistent inspector", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await startPatternRoomInstalledUi(installedCopy.rootDir);

    const archiveNavigation = environment.app.querySelector(
      "[data-pattern-workspace-nav='archive']"
    );
    const reportNavigation = environment.app.querySelector(
      "[data-pattern-workspace-nav='report']"
    );
    assert.ok(archiveNavigation);
    assert.ok(reportNavigation);
    fireEvent(archiveNavigation, "click");

    const inspectorContent = environment.app.querySelector(
      "[data-pattern-workspace-inspector-content='true']"
    );
    const initialDetail = environment.app.querySelector(
      "[data-pattern-archive-source-detail='true']"
    );
    assert.ok(inspectorContent);
    assert.ok(initialDetail);
    assert.equal(initialDetail.parentElement?.parentElement, inspectorContent);

    fireEvent(reportNavigation, "click");
    assert.ok(environment.app.querySelector("[data-pattern-view='report']"));
    fireEvent(archiveNavigation, "click");

    const restoredDetail = environment.app.querySelector(
      "[data-pattern-archive-source-detail='true']"
    );
    assert.ok(restoredDetail);
    assert.equal(restoredDetail.parentElement?.parentElement, inspectorContent);

    const inspectSource = environment.app.querySelector(
      "[data-pattern-inspect-source='source-shadow-comparison']"
    );
    assert.ok(inspectSource);
    fireEvent(inspectSource, "click");

    const selectedDetail = environment.app.querySelector(
      "[data-pattern-archive-source-detail-id='source-shadow-comparison']"
    );
    assert.ok(selectedDetail);
    assert.equal(selectedDetail.parentElement?.parentElement, inspectorContent);
    assert.equal(
      environment.app.querySelector("[data-pattern-workspace-inspector='true']")?.dataset[
        "patternWorkspaceInspectorView"
      ],
      "archive"
    );
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});

void test("pattern-room case review exposes distinct empty state variants", async () => {
  const environment = createMinimalForgeUiEnvironment();
  const installedCopy = await createRoomInstalledCopy("pattern-room");

  try {
    await startPatternRoomInstalledUi(installedCopy.rootDir);

    const reviewNavigation = environment.app.querySelector(
      "[data-pattern-workspace-nav='tenth-man']"
    );
    assert.ok(reviewNavigation);
    fireEvent(reviewNavigation, "click");

    assert.ok(
      environment.app.querySelector("[data-pattern-empty-state-kind='pending']")
    );
    assert.ok(
      environment.app.querySelector("[data-pattern-empty-state-kind='data-empty']")
    );
    assert.ok(
      environment.app.querySelector("[data-pattern-empty-state-kind='complete-empty']")
    );
  } finally {
    environment.restore();
    await installedCopy.cleanup();
  }
});
