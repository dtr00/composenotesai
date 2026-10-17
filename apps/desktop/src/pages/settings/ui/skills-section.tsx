import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { STARTER_SKILLS } from "../../../features/ai-chat/config/starter-skills";
import type { Skill, SkillSummary } from "../../../shared/api/skills";
import { useMountEffect } from "../../../shared/hooks/use-mount-effect";
import { Button } from "../../../shared/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../shared/ui/dropdown-menu";
import { Input } from "../../../shared/ui/input";
import { Switch } from "../../../shared/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../shared/ui/tooltip";
import { SETTING_IDS } from "../model/settings-search";
import {
  installSkillFiles,
  installSkillLink,
  installSkillText,
  openSkill,
  refreshSkills,
  removeSkill,
  toggleSkill,
  useSkills,
} from "../model/skills";
import { SettingsGroup } from "./settings-group";
import { SkillDialog } from "./skill-dialog";

function SkillRow({ skill, onEdit }: { skill: SkillSummary; onEdit: () => void }) {
  const labelId = `skill-${skill.id}-label`;
  return (
    <CardHeader>
      <CardTitle id={labelId} className="font-mono">
        {skill.name}
      </CardTitle>
      <CardDescription className="flex flex-col">
        <span>{skill.description}</span>
        {skill.source && <span className="truncate text-muted-foreground/70 select-text">{skill.source}</span>}
      </CardDescription>
      <CardAction className="flex items-center gap-1 self-center">
        <Switch
          aria-labelledby={labelId}
          checked={skill.enabled}
          onCheckedChange={(checked) => void toggleSkill(skill.id, checked)}
        />
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${skill.name}`}
                onClick={() => void removeSkill(skill.id)}
              />
            }
          >
            <Trash2 />
          </TooltipTrigger>
          <TooltipContent>Delete skill</TooltipContent>
        </Tooltip>
      </CardAction>
    </CardHeader>
  );
}

function LinkInstaller({ onDone }: { onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex items-center gap-2 px-(--card-spacing)"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const installed = await installSkillLink(url);
        setBusy(false);
        if (installed) {
          setUrl("");
          onDone();
        }
      }}
    >
      <Input
        autoFocus
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="Link to a SKILL.md file or a GitHub skill folder"
        aria-label="Skill link"
        className="h-7 min-w-0 flex-1 text-xs"
      />
      <Button type="submit" variant="outline" size="sm" disabled={!url.trim() || busy}>
        {busy ? "Installing…" : "Install"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onDone}>
        Cancel
      </Button>
    </form>
  );
}

function Suggested({ installed }: { installed: SkillSummary[] }) {
  const missing = STARTER_SKILLS.filter((starter) => !installed.some((skill) => skill.name === starter.name));
  if (missing.length === 0) return null;
  return (
    <SettingsGroup name="suggested-skills" title="Suggested">
      <Card size="sm">
        {missing.map((starter) => (
          <CardHeader key={starter.name}>
            <CardTitle>{starter.title}</CardTitle>
            <CardDescription>{starter.description}</CardDescription>
            <CardAction className="self-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void installSkillText(starter.text, null, starter.name)}
              >
                Install
              </Button>
            </CardAction>
          </CardHeader>
        ))}
      </Card>
    </SettingsGroup>
  );
}

export function SkillsSection() {
  const { skills } = useSkills();
  useMountEffect(() => void refreshSkills());
  const fileInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const write = (skill: Skill | null) => {
    setEditing(skill);
    setDialogOpen(true);
  };
  const edit = async (id: number) => {
    const skill = await openSkill(id);
    if (skill) write(skill);
  };

  return (
    <>
      <SettingsGroup
        name="skills"
        title="Installed skills"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>Add skill</DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => write(null)}>Write a skill</DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInput.current?.click()}>Install from a file</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLinking(true)}>Install from a link</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <input
          ref={fileInput}
          type="file"
          accept=".md,text/markdown"
          multiple
          hidden
          onChange={(event) => {
            void installSkillFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <Card id={SETTING_IDS.skills} size="sm">
          <p className="px-(--card-spacing) text-xs text-muted-foreground">
            The AI sees each skill&apos;s name and description, and reads the full instructions when a request matches.
            Skills use the SKILL.md format, so most published skills work here.
          </p>
          {linking && <LinkInstaller onDone={() => setLinking(false)} />}
          {skills?.length === 0 && (
            <CardHeader>
              <CardTitle>No skills yet</CardTitle>
              <CardDescription>
                Install a suggested skill below, write your own, or add a SKILL.md file.
              </CardDescription>
            </CardHeader>
          )}
          {skills?.map((skill) => (
            <SkillRow key={skill.id} skill={skill} onEdit={() => void edit(skill.id)} />
          ))}
        </Card>
      </SettingsGroup>
      {skills && <Suggested installed={skills} />}
      <SkillDialog open={dialogOpen} skill={editing} onOpenChange={setDialogOpen} />
    </>
  );
}
