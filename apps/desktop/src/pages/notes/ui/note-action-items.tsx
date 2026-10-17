import { Fragment, type ComponentType, type ReactNode } from "react";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "../../../shared/ui/context-menu";
import type { NoteAction, NoteCommand } from "../model/note-actions";

export interface MenuParts {
  Item: ComponentType<{
    variant?: NoteCommand["variant"];
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
  }>;
  Separator: ComponentType;
  Sub: ComponentType<{ children: ReactNode }>;
  SubTrigger: ComponentType<{ children: ReactNode }>;
  SubContent: ComponentType<{ children: ReactNode }>;
}

export const CONTEXT_MENU_PARTS: MenuParts = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
};

export function NoteActionItems({ groups, parts }: { groups: NoteAction[][]; parts: MenuParts }) {
  const { Item, Separator, Sub, SubTrigger, SubContent } = parts;
  return groups.map((group, index) => (
    <Fragment key={index}>
      {index > 0 && <Separator />}
      {group.map((action, position) =>
        "groups" in action ? (
          <Sub key={position}>
            <SubTrigger>{action.label}</SubTrigger>
            <SubContent>
              <NoteActionItems groups={action.groups} parts={parts} />
            </SubContent>
          </Sub>
        ) : (
          <Item key={position} variant={action.variant} disabled={action.disabled} onClick={action.run}>
            {action.label}
          </Item>
        ),
      )}
    </Fragment>
  ));
}
