import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import yaml from 'js-yaml'

const here = dirname(fileURLToPath(import.meta.url))
const workflowPath = join(here, '..', '.github', 'workflows', 'deploy.yml')

/** Parse the deploy workflow into a plain object describing its trigger policy. */
function loadDeployWorkflow() {
  const text = readFileSync(workflowPath, 'utf-8')
  return yaml.load(text)
}

/**
 * The `push` trigger's config from the workflow's `on` field.
 * `on` may be a list of event names or an object mapping events to their config;
 * a bare `push` in a list carries no filter config, so it normalizes to `{}`.
 */
function pushTrigger(wf) {
  const on = wf.on
  if (Array.isArray(on)) return on.includes('push') ? {} : undefined
  return on?.push
}

describe('deploy workflow trigger policy', () => {
  it('does NOT auto-deploy on push to main (the redesign regression)', () => {
    const wf = loadDeployWorkflow()

    // If there is no push trigger at all, it trivially can't deploy main — fine.
    const branches = pushTrigger(wf)?.branches
    const triggersMain = Array.isArray(branches) && branches.includes('main')

    expect(triggersMain).toBe(false)
  })

  it('deploys when a release-* tag is pushed', () => {
    const wf = loadDeployWorkflow()

    const tags = pushTrigger(wf)?.tags
    const releasesOnTag = Array.isArray(tags) && tags.includes('release-*')

    expect(releasesOnTag).toBe(true)
  })

  it('lets a manual dispatch deploy any ref via an inputs.ref the checkout honors', () => {
    const wf = loadDeployWorkflow()

    // The dispatch trigger must expose a `ref` input.
    const refInput = wf.on?.workflow_dispatch?.inputs?.ref
    expect(refInput).toBeDefined()
    expect(refInput.required).toBe(true)

    // The checkout step must honor that input so a tag/SHA/branch of choice deploys.
    const steps = Object.values(wf.jobs).flatMap((job) => job.steps ?? [])
    const checkout = steps.find((s) => typeof s.uses === 'string' && s.uses.includes('actions/checkout'))
    expect(checkout).toBeDefined()
    expect(checkout.with?.ref).toBe('${{ inputs.ref || github.ref }}')
  })
})
