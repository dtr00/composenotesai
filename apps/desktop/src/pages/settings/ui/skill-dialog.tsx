import { useState } from "react";
import type { Skill } from "../../../shared/api/skills";
import { Button } from "../../../shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../shared/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "../../../shared/ui/field";
import { Input } from "../../../shared/ui/input";
import { Textarea } from "../../../shared/ui/textarea";
import { writeSkill } from "../model/skills";

const PLACEHOLDER = `Use this when the user asks for…

1. Read the note first.
2. …`;

function SkillForm({ skill, onDone }: { skill: Skill | null; onDone: () => void }) {
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [body, setBody] = useState(skill?.body ?? "");
  const ready = name.trim() && description.trim() && body.trim();

  return (
    <form
      className="flex min-h-0 flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!ready) return;
        if (await writeSkill(skill?.id ?? null, name, description, body)) onDone();
      }}
    >
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="skill-name">Name</FieldLabel>
          <Input
            id="skill-name"
            value={name}
            placeholder="meeting-notes"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="skill-description">When to use it</FieldLabel>
          <Input
            id="skill-description"
            value={description}
            placeholder="Turn meeting notes into a summary with action items."
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="skill-body">Instructions</FieldLabel>
          <Textarea
            id="skill-body"
            value={body}
            placeholder={PLACEHOLDER}
            onChange={(event) => setBody(event.target.value)}
            className="max-h-[45vh] min-h-48 font-mono text-xs"
          />
          <FieldDescription>Markdown. Write it like steps for a helpful assistant.</FieldDescription>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!ready}>
          {skill ? "Save" : "Add skill"}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface SkillDialogProps {
  open: boolean;
  skill: Skill | null;
  onOpenChange: (open: boolean) => void;
}

export function SkillDialog({ open, skill, onOpenChange }: SkillDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{skill ? "Edit skill" : "Write a skill"}</DialogTitle>
          <DialogDescription>
            Skills are instructions Compose AI follows for a specific kind of request.
          </DialogDescription>
        </DialogHeader>
        {open && <SkillForm key={skill?.id ?? "new"} skill={skill} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
