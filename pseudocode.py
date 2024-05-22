      when detectCollision(node1, node2):
          lca = getLastCommonAncestorNode(node1, node2)
          if lca:
              # Step 1: Find the sequence of nodes from node 1 to LCA
              sequence1_to_lca = getSequenceToLCA(node1, lca)

              # Step 2: Find the first child of LCA in the sequence that node 2 is not descended from
              bucket_parent1 = None
              for node in sequence1_to_lca:
                  if not isDescendant(node2, node):
                      bucket_parent1 = node
                      break

              # Step 3: Gather all children of the bucket parent downwards and store them in bucket 1
              bucket1 = collectAllDescendants(bucket_parent1)

              # Step 4: Repeat the process for bucket 2
              # Find the sequence of nodes from node 2 to LCA
              sequence2_to_lca = getSequenceToLCA(node2, lca)

              # Find the first child of LCA in the sequence that node 1 is not descended from
              bucket_parent2 = None
              for node in sequence2_to_lca:
                  if not isDescendant(node1, node):
                      bucket_parent2 = node
                      break

              # Gather all children of the bucket parent downwards and store them in bucket 2
              bucket2 = collectAllDescendants(bucket_parent2)

              # The resulting buckets are bucket1 and bucket2

      function getLastCommonAncestorNode(node1, node2):
          // Implement logic to find the Last Common Ancestor of node1 and node2
          // Return the LCA node

      function getSequenceToLCA(startNode, lcaNode):
          // Implement logic to get the sequence of nodes from startNode to lcaNode
          // Return the sequence as a list- STARTING from the LCA and going to the start node

      function isDescendant(ancestor, possibleDescendant):
          // Implement logic to determine if possibleDescendant is a descendant of ancestor
          // Return True or False

      function collectAllDescendants(node):
          // Implement logic to gather all descendants of the given node
          // Return the collected descendants as a list