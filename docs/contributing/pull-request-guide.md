# Pull Request Guide

## Before You Submit

### 1. Checklist
- [ ] Code follows [Style Guide](./style-guide.md)
- [ ] All tests pass (`npm run test`)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] ESLint passes (`npm run lint`)
- [ ] No `console.log` or `debugger` statements
- [ ] Documentation updated if needed
- [ ] Commits follow [Conventional Commits](#commit-messages)

### 2. Branch Naming
```
feat/short-description    # New feature
fix/short-description     # Bug fix
docs/short-description    # Documentation
refactor/short-description # Code restructuring
test/short-description    # Tests
chore/short-description   # Maintenance
```

### 3. Commit Messages
```
feat(auth): add token refresh mechanism

fix(api): handle VTOP timeout gracefully

docs(api): update attendance endpoint docs
```

## Creating the PR

### 1. Push Your Branch
```bash
git push origin feat/your-feature-name
```

### 2. Open Pull Request
- Go to GitHub repository
- Click "New Pull Request"
- Select your branch as compare
- Fill in the PR template

### 3. PR Template
```markdown
## Summary
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix/feature causing existing functionality to change)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Test updates

## Related Issues
Closes #123
Fixes #456

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed
- [ ] All existing tests pass

## Screenshots (if applicable)
| Before | After |
|--------|-------|
| ![before](url) | ![after](url) |

## Checklist
- [ ] My code follows the style guide
- [ ] I have performed a self-review
- [ ] I have commented complex code
- [ ] I have updated documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing unit tests pass locally
- [ ] Any dependent changes have been merged and published
```

## During Review

### Responding to Feedback
- Be responsive and respectful
- Address all comments
- Push new commits to the same branch
- Don't force push unless asked

### Common Review Comments
| Comment | Action |
|---------|--------|
| "Please add tests" | Add unit/integration tests |
| "Update documentation" | Update relevant docs |
| "Follow style guide" | Run `npm run lint:fix` |
| "TypeScript error" | Fix type issues |
| "Breaking change" | Add migration guide |

### Review Timeline
- First review: Within 48 hours
- Follow-up reviews: Within 24 hours
- Final approval: After all checks pass

## After Approval

### 1. Merge
- Maintainer will merge (squash and merge preferred)
- Branch will be deleted automatically

### 2. Clean Up
```bash
git checkout main
git pull upstream main
git branch -d feat/your-feature-name
git push origin --delete feat/your-feature-name  # If not auto-deleted
```

## PR Best Practices

### Keep PRs Small
- One feature/fix per PR
- Easier to review
- Less chance of conflicts
- Faster merge

### Write Clear Descriptions
- What changed and why
- Link related issues
- Include screenshots for UI changes

### Test Thoroughly
- Run all tests locally
- Test edge cases
- Manual verification

### Update Documentation
- API docs for new endpoints
- README for user-facing changes
- Architecture docs for structural changes

## Special Cases

### Breaking Changes
1. Mark PR as breaking change
2. Update version in `package.json`
3. Add migration guide in docs
4. Notify maintainers

### Hotfixes
1. Branch from `main` or latest release
2. Prefix with `hotfix/`
3. Fast-track review
4. Backport if needed

### Dependencies
1. Update `package.json` and `package-lock.json`
2. Test thoroughly
3. Check for breaking changes in deps
4. Update lockfile

## CI/CD Checks

All PRs must pass:
- [ ] Lint (`npm run lint`)
- [ ] TypeCheck (`npm run typecheck`)
- [ ] Tests (`npm run test`)
- [ ] Build (`npm run build`)

## Getting Help

- Ask in PR comments
- [GitHub Discussions](https://github.com/AmazeContinuityProjects/AmazeCC/discussions)
- Tag maintainers: `@SugeethJSA`, `@dhivyanj`, `@ANASARFEEN123`

---

**Remember**: A good PR is a reviewed PR. Take the time to do it right!